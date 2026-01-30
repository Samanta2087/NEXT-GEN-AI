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
      "--no-playlist",
      // Stealth and IP fixes
      "--force-ipv4",
      "--extractor-args", "youtube:player_client=android,web;player_skip=configs",
      "--skip-download",
      "--no-check-certificates",
      url,
    ];

    const ytdlpProcess = spawn("yt-dlp", args);
    let stdout = "";
    let stderr = "";

    ytdlpProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on("close", (code) => {
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

    ytdlpProcess.on("error", (err) => {
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

  console.log(`[yt-dlp] ============================================`);
  console.log(`[yt-dlp] Download started`);
  console.log(`[yt-dlp] jobId: ${jobId}`);
  console.log(`[yt-dlp] url: ${url}`);
  console.log(`[yt-dlp] mode: ${mode}`);
  console.log(`[yt-dlp] resolution: ${resolution}`);
  console.log(`[yt-dlp] formatId: ${formatId}`);
  console.log(`[yt-dlp] audioFormat: ${audioFormat}`);
  console.log(`[yt-dlp] audioBitrate: ${audioBitrate}`);
  console.log(`[yt-dlp] ============================================`);

  const ext = mode === "audio" ? (audioFormat || "mp3") : "mp4";
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);
  const finalPath = path.join(DOWNLOAD_DIR, `${jobId}.${ext}`);

  const args: string[] = [
    "--no-warnings",
    "--newline",
    "--progress",
    // Avoid 403 errors and bot detection
    "--force-ipv4",
    "--extractor-args", "youtube:player_client=android,web;player_skip=configs",
    // Faster download settings
    "--concurrent-fragments", "4", // Download 4 fragments at once for HLS
    "--no-playlist", // Don't download entire playlist
    "--no-part", // Don't use .part files (faster)
    "--retries", "3",
    "--fragment-retries", "3",
    // Buffer settings for faster downloads
    "--buffer-size", "16K",
    "-o", outputTemplate,
  ];

  if (mode === "audio") {
    // For audio: prefer progressive download formats over HLS
    // Format 140 = m4a audio 128kbps
    // Format 139 = m4a audio 48kbps
    // Avoid audio-only streams that may be blocked
    args.push("-f", "140/139/bestaudio[ext=m4a]/bestaudio/best");
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
    // For video: AVOID HLS live streams (91-96, 298-303) which cause 403 errors
    // Use progressive download formats or regular adaptive streams
    if (formatId) {
      // Check if user selected an HLS format and redirect to better option
      const hlsFormats = ["91", "92", "93", "94", "95", "96", "298", "299", "300", "301", "302", "303"];
      if (hlsFormats.includes(formatId)) {
        // Redirect to equivalent progressive format
        console.log(`[yt-dlp] HLS format ${formatId} detected, using alternative to avoid 403 errors`);
        args.push("-f", "137+140/136+140/22/18/best[ext=mp4]/best");
      } else {
        args.push("-f", formatId);
      }
    } else if (resolution) {
      const height = resolution.replace("p", "");
      // Use progressive download formats ONLY - these don't get 403 errors
      // Format 22 = 720p with audio
      // Format 18 = 360p with audio
      // Merge higher res video with audio format 140
      if (height === "1080") {
        args.push("-f", "137+140/22/best[height<=1080][ext=mp4]/best");
      } else if (height === "720") {
        args.push("-f", "22/136+140/best[height<=720][ext=mp4]/best");
      } else if (height === "480") {
        args.push("-f", "135+140/best[height<=480][ext=mp4]/18/best");
      } else if (height === "360") {
        args.push("-f", "18/134+140/best[height<=360][ext=mp4]/best");
      } else {
        args.push("-f", "18/best[height<=" + height + "][ext=mp4]/best");
      }
    } else {
      // Default: use format 22 (720p) or 18 (360p) - most reliable
      args.push("-f", "22/18/136+140/135+140/best[ext=mp4]/best");
    }
    args.push("--merge-output-format", "mp4");
  }

  args.push(url);

  console.log(`[yt-dlp] Full command: yt-dlp ${args.join(" ")}`);

  return new Promise((resolve, reject) => {
    const ytdlpProcess = spawn("yt-dlp", args);
    let lastProgress = 0;
    let allOutput = "";

    console.log(`[yt-dlp] Process spawned with PID: ${ytdlpProcess.pid}`);

    ytdlpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      allOutput += output;
      console.log(`[yt-dlp stdout] ${output.trim()}`);
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

    ytdlpProcess.stderr.on("data", (data) => {
      const stderr = data.toString();
      console.error(`[yt-dlp stderr] ${stderr.trim()}`);
      allOutput += stderr;
    });

    ytdlpProcess.on("close", (code) => {
      console.log(`[yt-dlp] Process exited with code: ${code}`);

      if (code !== 0) {
        console.error(`[yt-dlp] Download failed. Full output:\n${allOutput}`);
        reject(new Error(`Download failed with exit code ${code}`));
        return;
      }

      const files = fs.readdirSync(DOWNLOAD_DIR);
      const outputFile = files.find(f => f.startsWith(jobId) && !f.endsWith('.part') && !f.endsWith('.ytdl'));

      console.log(`[yt-dlp] Looking for output file starting with: ${jobId}`);
      console.log(`[yt-dlp] Files in directory: ${files.filter(f => f.startsWith(jobId)).join(', ')}`);

      if (!outputFile) {
        reject(new Error("Output file not found"));
        return;
      }

      const outputPath = path.join(DOWNLOAD_DIR, outputFile);
      const stats = fs.statSync(outputPath);

      console.log(`[yt-dlp] Download complete: ${outputFile} (${stats.size} bytes)`);
      onProgress(100, "downloading");
      resolve({ outputPath: outputFile, fileSize: stats.size });
    });

    ytdlpProcess.on("error", (err) => {
      console.error(`[yt-dlp] Spawn error: ${err.message}`);
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
    if (format.hasVideo) {
      // Try to get resolution from height directly first
      // format.resolution is often string like "1920x1080" or just "1080p"
      let heightVal: number | null = null;

      if (format.resolution) {
        if (format.resolution.includes("x")) {
          const parts = format.resolution.split("x");
          heightVal = parseInt(parts[1]);
        } else if (format.resolution.includes("p")) {
          heightVal = parseInt(format.resolution.replace("p", ""));
        }
      }

      // If no valid height from resolution string, try parsing the string itself if it's just a number
      if (!heightVal && format.resolution && !isNaN(parseInt(format.resolution))) {
        heightVal = parseInt(format.resolution);
      }

      if (heightVal && !isNaN(heightVal)) {
        if (heightVal >= 144) { // Filter out very low res or thumbnails
          // Normalize to standard resolutions
          if (heightVal >= 4320) resolutions.add("8K");
          else if (heightVal >= 2160) resolutions.add("4K");
          else if (heightVal >= 1440) resolutions.add("1440p");
          else if (heightVal >= 1080) resolutions.add("1080p");
          else if (heightVal >= 720) resolutions.add("720p");
          else if (heightVal >= 480) resolutions.add("480p");
          else if (heightVal >= 360) resolutions.add("360p");
          else if (heightVal >= 240) resolutions.add("240p");
          else if (heightVal >= 144) resolutions.add("144p");
          else resolutions.add(`${heightVal}p`);
        }
      }
    }
  }

  const resOrder = ["8K", "4K", "1440p", "1080p", "720p", "480p", "360p", "240p", "144p"];

  return Array.from(resolutions).sort((a, b) => {
    const aIndex = resOrder.indexOf(a);
    const bIndex = resOrder.indexOf(b);

    // If both are standard resolutions, sort by index
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // Otherwise sort numerically
    const aNum = parseInt(a.replace("p", "").replace("K", "000"));
    const bNum = parseInt(b.replace("p", "").replace("K", "000"));
    return bNum - aNum;
  });
}
