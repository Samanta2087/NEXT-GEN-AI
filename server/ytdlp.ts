import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import type { MediaInfo, MediaFormat, SupportedPlatform, DownloadJob, AudioFormat } from "@shared/schema";

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function detectPlatform(url: string): SupportedPlatform {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return "youtube";
  }
  if (urlLower.includes("instagram.com")) {
    return "instagram";
  }
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) {
    return "facebook";
  }
  return "unknown";
}

function parseFormat(format: any): MediaFormat {
  const hasVideo = format.vcodec && format.vcodec !== "none";
  const hasAudio = format.acodec && format.acodec !== "none";
  
  let resolution: string | undefined;
  if (format.height) {
    resolution = `${format.height}p`;
  } else if (format.resolution && format.resolution !== "audio only") {
    resolution = format.resolution;
  }

  return {
    formatId: format.format_id || "",
    ext: format.ext || "",
    resolution,
    fps: format.fps,
    vcodec: hasVideo ? format.vcodec : undefined,
    acodec: hasAudio ? format.acodec : undefined,
    filesize: format.filesize,
    filesizeApprox: format.filesize_approx,
    tbr: format.tbr,
    abr: format.abr,
    vbr: format.vbr,
    quality: format.format_note || format.quality,
    hasVideo,
    hasAudio,
  };
}

export async function analyzeUrl(url: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--flat-playlist",
      url,
    ];

    const process = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        let errorMsg = stderr || "Failed to analyze URL";
        if (errorMsg.includes("age")) {
          errorMsg = "This content is age-restricted and requires login";
        } else if (errorMsg.includes("geo") || errorMsg.includes("country")) {
          errorMsg = "This content is not available in your region";
        } else if (errorMsg.includes("private")) {
          errorMsg = "This content is private";
        } else if (errorMsg.includes("unavailable")) {
          errorMsg = "This content is unavailable";
        }
        reject(new Error(errorMsg));
        return;
      }

      try {
        const lines = stdout.trim().split("\n");
        const firstLine = lines[0];
        const data = JSON.parse(firstLine);
        
        const platform = detectPlatform(url);
        const isPlaylist = data._type === "playlist" || lines.length > 1;

        const formats: MediaFormat[] = (data.formats || []).map(parseFormat);
        
        const videoFormats = formats.filter(f => f.hasVideo);
        const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);
        
        const bestVideo = videoFormats.sort((a, b) => {
          const aHeight = parseInt(a.resolution?.replace("p", "") || "0");
          const bHeight = parseInt(b.resolution?.replace("p", "") || "0");
          return bHeight - aHeight;
        })[0];

        const bestAudio = audioFormats.sort((a, b) => {
          return (b.abr || 0) - (a.abr || 0);
        })[0];

        const info: MediaInfo = {
          id: data.id || Date.now().toString(),
          title: data.title || "Untitled",
          description: data.description,
          thumbnail: data.thumbnail,
          duration: data.duration,
          uploader: data.uploader || data.channel,
          uploadDate: data.upload_date,
          viewCount: data.view_count,
          platform,
          url,
          formats,
          bestVideo,
          bestAudio,
          isPlaylist,
          playlistCount: isPlaylist ? lines.length : undefined,
        };

        resolve(info);
      } catch (e) {
        reject(new Error("Failed to parse media information"));
      }
    });

    process.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

interface DownloadOptions {
  jobId: string;
  url: string;
  mode: "video" | "audio";
  formatId?: string;
  resolution?: string;
  audioFormat?: AudioFormat;
  audioBitrate?: number;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
  };
  onProgress: (progress: number, stage: "downloading" | "converting") => void;
}

export async function downloadMedia(options: DownloadOptions): Promise<{ outputPath: string; fileSize: number }> {
  const { jobId, url, mode, formatId, resolution, audioFormat, audioBitrate, metadata, onProgress } = options;
  
  const ext = mode === "audio" ? (audioFormat || "mp3") : "mp4";
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);
  const finalPath = path.join(DOWNLOAD_DIR, `${jobId}.${ext}`);

  const args: string[] = [
    "--no-warnings",
    "--newline",
    "--progress",
    "-o", outputTemplate,
  ];

  if (mode === "audio") {
    args.push("-x");
    args.push("--audio-format", audioFormat || "mp3");
    if (audioBitrate) {
      args.push("--audio-quality", `${audioBitrate}K`);
    }
    
    if (metadata) {
      if (metadata.title) args.push("--parse-metadata", `title:${metadata.title}`);
      if (metadata.artist) args.push("--parse-metadata", `artist:${metadata.artist}`);
    }
  } else {
    if (formatId) {
      args.push("-f", formatId);
    } else if (resolution) {
      args.push("-f", `bestvideo[height<=${resolution.replace("p", "")}]+bestaudio/best[height<=${resolution.replace("p", "")}]/best`);
    } else {
      args.push("-f", "bestvideo+bestaudio/best");
    }
    args.push("--merge-output-format", "mp4");
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const process = spawn("yt-dlp", args);
    let lastProgress = 0;

    process.stdout.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");
      
      for (const line of lines) {
        const downloadMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (downloadMatch) {
          const progress = Math.min(parseFloat(downloadMatch[1]), 99);
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress, "downloading");
          }
        }

        if (line.includes("[ExtractAudio]") || line.includes("[Merger]") || line.includes("[ffmpeg]")) {
          onProgress(95, "converting");
        }
      }
    });

    process.stderr.on("data", (data) => {
      console.error("yt-dlp stderr:", data.toString());
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Download failed"));
        return;
      }

      const files = fs.readdirSync(DOWNLOAD_DIR);
      const outputFile = files.find(f => f.startsWith(jobId));
      
      if (!outputFile) {
        reject(new Error("Output file not found"));
        return;
      }

      const outputPath = path.join(DOWNLOAD_DIR, outputFile);
      const stats = fs.statSync(outputPath);

      onProgress(100, "downloading");
      resolve({ outputPath: outputFile, fileSize: stats.size });
    });

    process.on("error", (err) => {
      reject(new Error(`yt-dlp error: ${err.message}`));
    });
  });
}

export function getDownloadPath(filename: string): string {
  return path.join(DOWNLOAD_DIR, filename);
}

export function cleanupDownload(filename: string): boolean {
  try {
    const filePath = path.join(DOWNLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function getAvailableResolutions(formats: MediaFormat[]): string[] {
  const resolutions = new Set<string>();
  
  for (const format of formats) {
    if (format.hasVideo && format.resolution) {
      const height = format.resolution.replace("p", "");
      if (!isNaN(parseInt(height))) {
        resolutions.add(format.resolution);
      }
    }
  }

  return Array.from(resolutions).sort((a, b) => {
    const aNum = parseInt(a.replace("p", ""));
    const bNum = parseInt(b.replace("p", ""));
    return bNum - aNum;
  });
}
