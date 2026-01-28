import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { storage } from "./storage";
import { createJobSchema, updateJobSchema } from "@shared/schema";
import { analyzeUrl, downloadMedia, getDownloadPath, cleanupDownload, getAvailableResolutions } from "./ytdlp";
import type { DownloadJob, MediaInfo } from "@shared/schema";

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
    let command = ffmpeg(inputPath);

    if (trimStart !== undefined && trimStart > 0) {
      command = command.setStartTime(trimStart);
    }

    if (trimEnd !== undefined && trimStart !== undefined) {
      command = command.setDuration(trimEnd - trimStart);
    } else if (trimEnd !== undefined) {
      command = command.setDuration(trimEnd);
    }

    let duration = 0;

    const outputOptions: string[] = [];
    
    if (metadata?.title) {
      outputOptions.push(`-metadata`, `title=${metadata.title}`);
    }
    if (metadata?.artist) {
      outputOptions.push(`-metadata`, `artist=${metadata.artist}`);
    }
    if (metadata?.album) {
      outputOptions.push(`-metadata`, `album=${metadata.album}`);
    }

    command
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(bitrate)
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions(outputOptions)
      .on("codecData", (data) => {
        const durationStr = data.duration;
        if (durationStr) {
          const parts = durationStr.split(":");
          if (parts.length === 3) {
            duration = 
              parseFloat(parts[0]) * 3600 +
              parseFloat(parts[1]) * 60 +
              parseFloat(parts[2]);
          }
        }
      })
      .on("progress", (progress) => {
        const percent = Math.min(Math.round(progress.percent || 0), 99);
        broadcastProgress(jobId, percent);
      })
      .on("end", () => {
        resolve({ duration });
      })
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .save(outputPath);
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
        try { fs.unlinkSync(job.inputPath); } catch (e) {}
      }
      
      const outputPath = path.join(OUTPUT_DIR, `${req.params.id}.mp3`);
      if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch (e) {}
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

  return httpServer;
}
