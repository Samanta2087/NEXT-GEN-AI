import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { storage } from "./storage";
import { createJobSchema, updateJobSchema } from "@shared/schema";

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
        bitrate: bitrate,
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

  return httpServer;
}
