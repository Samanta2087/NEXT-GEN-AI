import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn, execSync } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { storage } from "./storage";
import { createJobSchema, updateJobSchema } from "@shared/schema";
import { analyzeUrl, downloadMedia, getDownloadPath, cleanupDownload, getAvailableResolutions } from "./ytdlp";
import type { DownloadJob, MediaInfo, ImageJob, PdfJob, ImageSettings, PdfSettings } from "@shared/schema";
import * as imageProcessor from "./imageProcessor";
import * as pdfProcessor from "./pdfProcessor";
import { uploadLimiter, downloadLimiter, analyzeLimiter, conversionLimiter } from "./security";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "output");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const jobId = req.body.jobId || Date.now().toString();
      const ext = path.extname(file.originalname);
      cb(null, `${jobId}${ext}`);
    },
  }),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: MP4, MKV, AVI, MOV, WEBM"));
    }
  },
});

const clients = new Map<string, WebSocket>();

function broadcastProgress(jobId: string, progress: number) {
  const message = JSON.stringify({ type: "progress", jobId, progress });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastCompleted(jobId: string, outputPath: string, duration: number) {
  const message = JSON.stringify({ type: "completed", jobId, outputPath, duration });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function broadcastError(jobId: string, errorMessage: string) {
  const message = JSON.stringify({ type: "error", jobId, message: errorMessage });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function convertToMp3(
  inputPath: string,
  outputPath: string,
  bitrate: number,
  jobId: string,
  trimStart?: number,
  trimEnd?: number,
  metadata?: { title?: string; artist?: string; album?: string }
): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['-i', inputPath];

    // Add trim options
    if (trimStart !== undefined && trimStart > 0) {
      args.push('-ss', trimStart.toString());
    }
    if (trimEnd !== undefined && trimStart !== undefined) {
      args.push('-t', (trimEnd - trimStart).toString());
    } else if (trimEnd !== undefined) {
      args.push('-t', trimEnd.toString());
    }

    // Audio settings
    args.push('-vn'); // No video
    args.push('-acodec', 'libmp3lame');
    args.push('-ab', `${bitrate}k`);
    args.push('-ac', '2');
    args.push('-ar', '44100');

    // Metadata
    if (metadata?.title) {
      args.push('-metadata', `title=${metadata.title}`);
    }
    if (metadata?.artist) {
      args.push('-metadata', `artist=${metadata.artist}`);
    }
    if (metadata?.album) {
      args.push('-metadata', `album=${metadata.album}`);
    }

    // Overwrite output
    args.push('-y');
    args.push(outputPath);

    console.log('FFmpeg command: ffmpeg', args.join(' '));

    const ffmpegProcess = spawn('ffmpeg', args, {
      windowsVerbatimArguments: false,
      shell: false
    });

    let duration = 0;
    let stderrData = '';

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      stderrData += output;

      // Parse duration from FFmpeg output
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 3600 +
          parseInt(durationMatch[2]) * 60 +
          parseInt(durationMatch[3]);
      }

      // Parse progress
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch && duration > 0) {
        const currentTime = parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]);
        const percent = Math.min(Math.round((currentTime / duration) * 100), 99);
        broadcastProgress(jobId, percent);
      }
    });

    ffmpegProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ duration });
      } else {
        console.error('FFmpeg stderr:', stderrData);
        // Check for common errors and provide better messages
        if (stderrData.includes('does not contain any stream') ||
          stderrData.includes('Output file #0 does not contain any stream')) {
          reject(new Error('The input video does not contain an audio track. Cannot convert to MP3.'));
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrData.slice(-500)}`));
        }
      }
    });

    ffmpegProcess.on('error', (err: Error) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);

    ws.on("close", () => {
      clients.delete(clientId);
    });

    ws.on("error", () => {
      clients.delete(clientId);
    });
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { jobId, bitrate } = req.body;

      if (!jobId || !bitrate) {
        return res.status(400).json({ message: "Missing jobId or bitrate" });
      }

      const inputPath = path.join(UPLOAD_DIR, req.file.filename);

      await storage.createJob(jobId, {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        bitrate: parseInt(bitrate),
        inputPath: inputPath,
      });

      res.json({
        success: true,
        jobId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  app.post("/api/upload-url", async (req, res) => {
    try {
      const { url, jobId, bitrate } = req.body;

      if (!url || !jobId || !bitrate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await storage.createJob(jobId, {
        fileName: url,
        originalName: url.split("/").pop()?.split("?")[0] || "video",
        fileSize: 0,
        bitrate: parseInt(bitrate),
      });

      res.json({ success: true, jobId, message: "URL processing is not supported in this version. Please upload files directly." });
    } catch (error: any) {
      console.error("URL upload error:", error);
      res.status(500).json({ message: error.message || "URL upload failed" });
    }
  });

  app.post("/api/convert", async (req, res) => {
    try {
      const { jobId, bitrate, trimStart, trimEnd, metadata } = req.body;

      if (!jobId || !bitrate) {
        return res.status(400).json({ message: "Missing jobId or bitrate" });
      }

      const job = await storage.getJob(jobId) as any;

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.inputPath || !fs.existsSync(job.inputPath)) {
        return res.status(404).json({ message: "Input file not found for this job" });
      }

      const outputFileName = `${jobId}.mp3`;
      const outputPath = path.join(OUTPUT_DIR, outputFileName);

      await storage.updateJob(jobId, {
        status: "processing",
        progress: 0,
        trimStart: trimStart,
        trimEnd: trimEnd,
        metadata: metadata,
      });

      try {
        const { duration } = await convertToMp3(
          job.inputPath,
          outputPath,
          bitrate,
          jobId,
          trimStart,
          trimEnd,
          metadata
        );

        await storage.updateJob(jobId, {
          status: "completed",
          progress: 100,
          outputPath: outputFileName,
          duration,
          completedAt: Date.now(),
        });

        broadcastCompleted(jobId, outputFileName, duration);

        try {
          fs.unlinkSync(job.inputPath);
        } catch (e) {
          console.error("Failed to delete input file:", e);
        }

        res.json({ success: true, outputPath: outputFileName, duration });
      } catch (conversionError: any) {
        await storage.updateJob(jobId, {
          status: "error",
          errorMessage: conversionError.message,
        });

        broadcastError(jobId, conversionError.message);
        res.status(500).json({ message: conversionError.message });
      }
    } catch (error: any) {
      console.error("Conversion error:", error);
      res.status(500).json({ message: error.message || "Conversion failed" });
    }
  });

  app.get("/api/download/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;

      const job = await storage.getJob(jobId) as any;

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const outputFileName = `${jobId}.mp3`;
      const filePath = path.join(OUTPUT_DIR, outputFileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Output file not found" });
      }

      const downloadName = job.originalName.replace(/\.[^/.]+$/, "") + ".mp3";

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error: any) {
      console.error("Download error:", error);
      res.status(500).json({ message: error.message || "Download failed" });
    }
  });

  app.get("/api/stream/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;

      const outputFileName = `${jobId}.mp3`;
      const filePath = path.join(OUTPUT_DIR, outputFileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "audio/mpeg",
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": "audio/mpeg",
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error: any) {
      console.error("Stream error:", error);
      res.status(500).json({ message: error.message || "Stream failed" });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id) as any;

      if (job?.inputPath && fs.existsSync(job.inputPath)) {
        try { fs.unlinkSync(job.inputPath); } catch (e) { }
      }

      const outputPath = path.join(OUTPUT_DIR, `${req.params.id}.mp3`);
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch (e) { }
      }

      const deleted = await storage.deleteJob(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const downloadJobs = new Map<string, DownloadJob>();
  let activeDownloads = 0;
  const MAX_CONCURRENT_DOWNLOADS = 3;

  function broadcastDownloadProgress(job: DownloadJob) {
    const message = JSON.stringify({ type: "download_progress", job });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  app.post("/api/social/analyze", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const mediaInfo = await analyzeUrl(url);
      const resolutions = getAvailableResolutions(mediaInfo.formats);

      res.json({
        success: true,
        mediaInfo,
        availableResolutions: resolutions,
      });
    } catch (error: any) {
      console.error("Analyze error:", error);
      res.status(500).json({ message: error.message || "Failed to analyze URL" });
    }
  });

  app.post("/api/social/download", async (req, res) => {
    try {
      const {
        jobId,
        url,
        platform,
        title,
        thumbnail,
        duration,
        mode,
        formatId,
        resolution,
        audioFormat,
        audioBitrate,
        metadata
      } = req.body;

      if (!jobId || !url || !mode) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
        return res.status(429).json({ message: "Too many concurrent downloads. Please wait." });
      }

      const job: DownloadJob = {
        id: jobId,
        url,
        platform: platform || "unknown",
        title: title || "Untitled",
        thumbnail,
        duration,
        status: "downloading",
        progress: 0,
        mode,
        selectedFormat: formatId,
        selectedResolution: resolution,
        audioFormat: audioFormat || "mp3",
        audioBitrate: audioBitrate || 192,
        metadata,
        createdAt: Date.now(),
      };

      downloadJobs.set(jobId, job);
      activeDownloads++;
      broadcastDownloadProgress(job);

      res.json({ success: true, jobId });

      try {
        const result = await downloadMedia({
          jobId,
          url,
          mode,
          formatId,
          resolution,
          audioFormat: audioFormat || "mp3",
          audioBitrate: audioBitrate || 192,
          metadata,
          onProgress: (progress, stage) => {
            const updatedJob = downloadJobs.get(jobId);
            if (updatedJob) {
              updatedJob.progress = progress;
              updatedJob.status = stage === "converting" ? "converting" : "downloading";
              if (stage === "downloading") {
                updatedJob.downloadProgress = progress;
              } else {
                updatedJob.convertProgress = progress;
              }
              downloadJobs.set(jobId, updatedJob);
              broadcastDownloadProgress(updatedJob);
            }
          },
        });

        const completedJob = downloadJobs.get(jobId);
        if (completedJob) {
          completedJob.status = "completed";
          completedJob.progress = 100;
          completedJob.outputPath = result.outputPath;
          completedJob.fileSize = result.fileSize;
          completedJob.completedAt = Date.now();
          downloadJobs.set(jobId, completedJob);
          broadcastDownloadProgress(completedJob);
        }
      } catch (error: any) {
        const failedJob = downloadJobs.get(jobId);
        if (failedJob) {
          failedJob.status = "error";
          failedJob.errorMessage = error.message;
          downloadJobs.set(jobId, failedJob);
          broadcastDownloadProgress(failedJob);
        }
      } finally {
        activeDownloads--;
      }
    } catch (error: any) {
      console.error("Download error:", error);
      res.status(500).json({ message: error.message || "Download failed" });
    }
  });

  app.get("/api/social/download/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = downloadJobs.get(jobId);

      if (!job || !job.outputPath) {
        return res.status(404).json({ message: "Download not found" });
      }

      const filePath = getDownloadPath(job.outputPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const ext = path.extname(job.outputPath);
      const downloadName = job.title.replace(/[<>:"/\\|?*]/g, "_") + ext;
      const contentType = ext === ".mp3" ? "audio/mpeg" :
        ext === ".m4a" ? "audio/mp4" :
          ext === ".mp4" ? "video/mp4" : "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error: any) {
      console.error("Download file error:", error);
      res.status(500).json({ message: error.message || "Download failed" });
    }
  });

  app.get("/api/social/stream/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = downloadJobs.get(jobId);

      if (!job || !job.outputPath) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = getDownloadPath(job.outputPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const stat = fs.statSync(filePath);
      const ext = path.extname(job.outputPath);
      const contentType = ext === ".mp3" ? "audio/mpeg" :
        ext === ".m4a" ? "audio/mp4" :
          ext === ".mp4" ? "video/mp4" : "application/octet-stream";

      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
        });
        file.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": stat.size,
          "Content-Type": contentType,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error: any) {
      console.error("Stream error:", error);
      res.status(500).json({ message: error.message || "Stream failed" });
    }
  });

  app.get("/api/social/jobs", async (req, res) => {
    try {
      const jobs = Array.from(downloadJobs.values());
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/social/jobs/:id", async (req, res) => {
    try {
      const job = downloadJobs.get(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/social/jobs/:id", async (req, res) => {
    try {
      const job = downloadJobs.get(req.params.id);

      if (job?.outputPath) {
        cleanupDownload(job.outputPath);
      }

      const deleted = downloadJobs.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const imageJobs = new Map<string, ImageJob>();
  const pdfJobs = new Map<string, PdfJob>();

  const IMAGE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");
  const PDF_UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdfs");

  if (!fs.existsSync(IMAGE_UPLOAD_DIR)) {
    fs.mkdirSync(IMAGE_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(PDF_UPLOAD_DIR)) {
    fs.mkdirSync(PDF_UPLOAD_DIR, { recursive: true });
  }

  const imageUpload = multer({
    storage: multer.diskStorage({
      destination: IMAGE_UPLOAD_DIR,
      filename: (req, file, cb) => {
        const jobId = req.body.jobId || Date.now().toString();
        const ext = path.extname(file.originalname);
        cb(null, `${jobId}${ext}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".svg"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid image type"));
      }
    },
  });

  const pdfUpload = multer({
    storage: multer.diskStorage({
      destination: PDF_UPLOAD_DIR,
      filename: (req, file, cb) => {
        const jobId = req.body.jobId || Date.now().toString();
        cb(null, `${jobId}.pdf`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === ".pdf") {
        cb(null, true);
      } else {
        cb(new Error("Only PDF files allowed"));
      }
    },
  });

  app.post("/api/image/upload", imageUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { jobId } = req.body;
      const filePath = req.file.path;

      const metadata = await imageProcessor.getImageMetadata(filePath);

      const job: ImageJob = {
        id: jobId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        status: "pending",
        progress: 0,
        operation: "convert",
        settings: {},
        createdAt: Date.now(),
      };

      imageJobs.set(jobId, job);

      res.json({
        job,
        metadata,
        previewUrl: `/api/image/preview/${jobId}`,
      });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/image/preview/:jobId", async (req, res) => {
    try {
      const job = imageJobs.get(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const filePath = path.join(IMAGE_UPLOAD_DIR, job.fileName);
      const preview = await imageProcessor.createPreview(filePath, 600, 70);

      res.set("Content-Type", "image/jpeg");
      res.send(preview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/image/process", async (req, res) => {
    try {
      const { jobId, operation, settings } = req.body;

      const job = imageJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      job.status = "processing";
      job.operation = operation;
      job.settings = settings;
      imageJobs.set(jobId, job);

      const inputPath = path.join(IMAGE_UPLOAD_DIR, job.fileName);
      // Determine output format based on operation
      let outputFormat: string;
      if (operation === "remove-bg") {
        outputFormat = "png"; // Required for transparency
      } else if (operation === "to-pdf") {
        outputFormat = "pdf"; // PDF output
      } else {
        outputFormat = settings.outputFormat || "jpg";
      }
      const outputPath = imageProcessor.getOutputPath(jobId, outputFormat);

      const result = await imageProcessor.processImage(
        inputPath,
        outputPath,
        operation,
        settings,
        (progress) => {
          job.progress = progress;
          imageJobs.set(jobId, job);
          broadcastImageProgress(jobId, progress);
        }
      );

      job.status = "completed";
      job.progress = 100;
      job.outputPath = result.outputPath;
      job.outputSize = result.outputSize;
      job.completedAt = Date.now();
      imageJobs.set(jobId, job);

      res.json({ job });
    } catch (error: any) {
      const job = imageJobs.get(req.body.jobId);
      if (job) {
        job.status = "error";
        job.errorMessage = error.message;
        imageJobs.set(req.body.jobId, job);
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/image/download/:jobId", async (req, res) => {
    try {
      const job = imageJobs.get(req.params.jobId);
      if (!job || !job.outputPath) {
        return res.status(404).json({ message: "File not found" });
      }

      const ext = path.extname(job.outputPath);
      const filename = `${job.originalName.replace(/\.[^.]+$/, "")}${ext}`;

      res.download(job.outputPath, filename);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/image/estimate", async (req, res) => {
    try {
      const { jobId, settings } = req.body;

      const job = imageJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(IMAGE_UPLOAD_DIR, job.fileName);
      const estimatedSize = await imageProcessor.estimateOutputSize(inputPath, settings);

      res.json({ estimatedSize });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/image/jobs", async (req, res) => {
    res.json(Array.from(imageJobs.values()));
  });

  app.delete("/api/image/jobs/:id", async (req, res) => {
    try {
      const job = imageJobs.get(req.params.id);
      if (job?.outputPath && fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
      const inputPath = path.join(IMAGE_UPLOAD_DIR, job?.fileName || "");
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      imageJobs.delete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/upload", pdfUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { jobId } = req.body;
      const filePath = req.file.path;

      const metadata = await pdfProcessor.getPdfMetadata(filePath);

      if (metadata.isEncrypted) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: "Password-protected PDFs are not supported" });
      }

      const job: PdfJob = {
        id: jobId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        pageCount: metadata.pageCount,
        status: "pending",
        progress: 0,
        operation: "merge",
        settings: {},
        createdAt: Date.now(),
      };

      pdfJobs.set(jobId, job);

      res.json({ job, metadata });
    } catch (error: any) {
      console.error("PDF upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pdf/pages/:jobId", async (req, res) => {
    try {
      const job = pdfJobs.get(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const filePath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const pages = await pdfProcessor.getPageThumbnails(filePath);

      res.json({ pages });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/merge", async (req, res) => {
    try {
      const { jobIds } = req.body;
      // Generate outputJobId if not provided
      const outputJobId = req.body.outputJobId || `pdf_merge_${Date.now()}`;

      const inputPaths = jobIds.map((id: string) => {
        const job = pdfJobs.get(id);
        if (!job) throw new Error(`Job ${id} not found`);
        return path.join(PDF_UPLOAD_DIR, job.fileName);
      });

      const outputPath = pdfProcessor.getOutputPath(outputJobId);

      const result = await pdfProcessor.mergePdfs(
        inputPaths,
        outputPath,
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: `${outputJobId}.pdf`,
        originalName: "merged.pdf",
        fileSize: result.outputSize,
        pageCount: result.pageCount,
        status: "completed",
        progress: 100,
        operation: "merge",
        settings: {},
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/split", async (req, res) => {
    try {
      const { jobId, ranges } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_split_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputDir = path.join(process.cwd(), "output", "pdfs", outputJobId);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Parse page ranges - convert to arrays of page numbers for pdfProcessor
      let pageRanges: number[][];
      if (ranges === "all") {
        // Split each page individually
        pageRanges = Array.from({ length: job.pageCount }, (_, i) => [i + 1]);
      } else if (typeof ranges === "string") {
        // Parse range string like "1-3,5,7-10"
        pageRanges = ranges.split(",").map((r: string) => {
          const parts = r.trim().split("-");
          if (parts.length === 1) {
            const page = parseInt(parts[0]);
            return [page];
          }
          const start = parseInt(parts[0]);
          const end = parseInt(parts[1]);
          return Array.from({ length: end - start + 1 }, (_, i) => start + i);
        });
      } else if (Array.isArray(ranges)) {
        pageRanges = ranges;
      } else {
        // Default: all pages as one range
        pageRanges = [Array.from({ length: job.pageCount }, (_, i) => i + 1)];
      }

      const result = await pdfProcessor.splitPdf(
        inputPath,
        outputDir,
        pageRanges,
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      // Create job for the first output (for download)
      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: result.outputs[0]?.fileName || `${outputJobId}.pdf`,
        originalName: `${job.originalName.replace('.pdf', '')}_split.zip`,
        fileSize: result.outputs.reduce((sum, o) => sum + (o.size || 0), 0),
        pageCount: result.outputs.length,
        status: "completed",
        progress: 100,
        operation: "split",
        settings: { ranges },
        outputPath: outputDir,
        outputSize: result.outputs.reduce((sum, o) => sum + (o.size || 0), 0),
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob, outputs: result.outputs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/rotate", async (req, res) => {
    try {
      const { jobId, pages, degrees } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_rotate_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputPath = pdfProcessor.getOutputPath(outputJobId);

      // Convert simplified params to pageRotations format
      let pageRotations: Array<{ page: number; degrees: number }>;
      if (pages === "all") {
        pageRotations = Array.from({ length: job.pageCount }, (_, i) => ({
          page: i + 1,
          degrees: degrees || 90
        }));
      } else if (Array.isArray(pages)) {
        pageRotations = pages.map((p: number) => ({ page: p, degrees: degrees || 90 }));
      } else {
        pageRotations = req.body.pageRotations || [{ page: 1, degrees: 90 }];
      }

      const result = await pdfProcessor.rotatePdfPages(
        inputPath,
        outputPath,
        pageRotations,
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: `${outputJobId}.pdf`,
        originalName: `${job.originalName.replace('.pdf', '')}_rotated.pdf`,
        fileSize: result.outputSize,
        pageCount: job.pageCount,
        status: "completed",
        progress: 100,
        operation: "rotate",
        settings: { pages, degrees },
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/delete-pages", async (req, res) => {
    try {
      const { jobId, pages } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_delete_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputPath = pdfProcessor.getOutputPath(outputJobId);

      // Ensure pages is an array
      const pagesToDelete = Array.isArray(pages) ? pages : [pages];

      const result = await pdfProcessor.deletePdfPages(
        inputPath,
        outputPath,
        pagesToDelete,
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: `${outputJobId}.pdf`,
        originalName: `${job.originalName.replace('.pdf', '')}_edited.pdf`,
        fileSize: result.outputSize,
        pageCount: result.pageCount,
        status: "completed",
        progress: 100,
        operation: "delete-pages",
        settings: { pages: pagesToDelete },
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/pdf/reorder", async (req, res) => {
    try {
      const { jobId, newOrder } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_reorder_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputPath = pdfProcessor.getOutputPath(outputJobId);

      // If no order provided, just return the same order
      const order = newOrder || Array.from({ length: job.pageCount }, (_, i) => i + 1);

      const result = await pdfProcessor.reorderPdfPages(
        inputPath,
        outputPath,
        order,
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: `${outputJobId}.pdf`,
        originalName: `${job.originalName.replace('.pdf', '')}_reordered.pdf`,
        fileSize: result.outputSize,
        pageCount: order.length,
        status: "completed",
        progress: 100,
        operation: "reorder",
        settings: { pageOrder: order },
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PDF Compress
  app.post("/api/pdf/compress", async (req, res) => {
    try {
      const { jobId, level } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_compress_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputPath = pdfProcessor.getOutputPath(outputJobId);

      // For now, just copy the file (pdf-lib doesn't have built-in compression)
      // Real compression would need Ghostscript or similar
      const result = await pdfProcessor.compressPdf(
        inputPath,
        outputPath,
        level || "medium",
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: `${outputJobId}.pdf`,
        originalName: `${job.originalName.replace('.pdf', '')}_compressed.pdf`,
        fileSize: result.outputSize,
        pageCount: job.pageCount,
        status: "completed",
        progress: 100,
        operation: "compress",
        settings: { level },
        outputPath: result.outputPath,
        outputSize: result.outputSize,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // PDF to Images
  app.post("/api/pdf/to-images", async (req, res) => {
    try {
      const { jobId, format } = req.body;
      const outputJobId = req.body.outputJobId || `pdf_images_${Date.now()}`;

      const job = pdfJobs.get(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const inputPath = path.join(PDF_UPLOAD_DIR, job.fileName);
      const outputDir = path.join(process.cwd(), "output", "pdfs", outputJobId);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const result = await pdfProcessor.pdfToImages(
        inputPath,
        outputDir,
        format || "png",
        85, // quality
        (progress) => broadcastPdfProgress(outputJobId, progress)
      );

      const outputJob: PdfJob = {
        id: outputJobId,
        fileName: result.outputs[0]?.fileName || `${outputJobId}.${format || 'png'}`,
        originalName: `${job.originalName.replace('.pdf', '')}_images.zip`,
        fileSize: result.outputs.reduce((sum, o) => sum + (o.size || 0), 0),
        pageCount: result.outputs.length,
        status: "completed",
        progress: 100,
        operation: "to-images",
        settings: { format },
        outputPath: outputDir,
        outputSize: result.outputs.reduce((sum, o) => sum + (o.size || 0), 0),
        createdAt: Date.now(),
        completedAt: Date.now(),
      };

      pdfJobs.set(outputJobId, outputJob);

      res.json({ job: outputJob, outputs: result.outputs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pdf/download/:jobId", async (req, res) => {
    try {
      const job = pdfJobs.get(req.params.jobId);
      if (!job || !job.outputPath) {
        return res.status(404).json({ message: "File not found" });
      }

      const filename = job.originalName || "document.pdf";

      // Check if outputPath is a directory (for split/to-images operations)
      const stats = fs.statSync(job.outputPath);

      if (stats.isDirectory()) {
        // Check how many files are in the directory
        const files = fs.readdirSync(job.outputPath);

        if (files.length === 1) {
          // Single file - download directly without zipping
          const singleFilePath = path.join(job.outputPath, files[0]);
          const singleFileName = files[0];
          res.download(singleFilePath, singleFileName);
        } else {
          // Multiple files - create a zip
          const archiver = await import('archiver');
          const archive = archiver.default('zip', { zlib: { level: 9 } });

          res.setHeader('Content-Type', 'application/zip');
          res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\.[^.]+$/, '.zip')}"`);

          archive.pipe(res);
          archive.directory(job.outputPath, false);
          await archive.finalize();
        }
      } else {
        res.download(job.outputPath, filename);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pdf/jobs", async (req, res) => {
    res.json(Array.from(pdfJobs.values()));
  });

  app.delete("/api/pdf/jobs/:id", async (req, res) => {
    try {
      const job = pdfJobs.get(req.params.id);
      if (job?.outputPath && fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
      const inputPath = path.join(PDF_UPLOAD_DIR, job?.fileName || "");
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      pdfJobs.delete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  function broadcastImageProgress(jobId: string, progress: number) {
    const message = JSON.stringify({ type: "image_progress", jobId, progress });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function broadcastPdfProgress(jobId: string, progress: number) {
    const message = JSON.stringify({ type: "pdf_progress", jobId, progress });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  return httpServer;
}
