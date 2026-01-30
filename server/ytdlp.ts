import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import type { MediaInfo, MediaFormat, SupportedPlatform, DownloadJob, AudioFormat } from "@shared/schema";

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Detect if running on Windows or Linux
const isWindows = os.platform() === "win32";
const isLinux = os.platform() === "linux";
const pathSeparator = isWindows ? ";" : ":";

/**
 * Get extended PATH that includes common locations for yt-dlp dependencies
 * Works on both Windows and Linux VPS
 */
function getExtendedPath(): string {
  const paths: string[] = [process.env.PATH || ""];

  if (isWindows) {
    // Windows: Add common Deno locations
    const userProfile = process.env.USERPROFILE || "";
    if (userProfile) {
      paths.push(path.join(userProfile, ".deno", "bin"));
      paths.push(path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python311"));
      paths.push(path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python312"));
      paths.push(path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python313"));
    }
  } else {
    // Linux VPS: Add common binary locations
    const home = process.env.HOME || "/root";
    paths.push("/usr/local/bin");
    paths.push("/usr/bin");
    paths.push("/bin");
    paths.push("/snap/bin");
    // Always add root Deno path for VPS
    paths.push("/root/.deno/bin");
    paths.push("/root/.local/bin");
    if (home && home !== "/root") {
      paths.push(path.join(home, ".deno", "bin"));
      paths.push(path.join(home, ".local", "bin"));
      paths.push(path.join(home, "bin"));
    }
  }

  return paths.filter(Boolean).join(pathSeparator);
}

/**
 * Check if yt-dlp is installed and accessible
 */
function checkYtDlpInstalled(): boolean {
  try {
    const cmd = isWindows ? "where yt-dlp" : "which yt-dlp";
    execSync(cmd, { stdio: "ignore", env: { ...process.env, PATH: getExtendedPath() } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if ffmpeg is installed (required for audio extraction)
 */
function checkFfmpegInstalled(): boolean {
  try {
    const cmd = isWindows ? "where ffmpeg" : "which ffmpeg";
    execSync(cmd, { stdio: "ignore", env: { ...process.env, PATH: getExtendedPath() } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cookies file path - checks multiple locations
 */
function getCookiesPath(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), "cookies.txt"),
    path.resolve(process.cwd(), "config", "cookies.txt"),
    path.resolve("/etc/yt-dlp", "cookies.txt"),
    path.resolve(os.homedir(), ".config", "yt-dlp", "cookies.txt"),
  ];

  for (const cookiePath of possiblePaths) {
    if (fs.existsSync(cookiePath)) {
      return cookiePath;
    }
  }
  return null;
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
  const hasVideo = (format.vcodec && format.vcodec !== "none") || (format.format_note && format.format_note.toLowerCase().includes("p"));
  const hasAudio = format.acodec && format.acodec !== "none";

  let resolution: string | undefined;
  if (format.height) {
    resolution = `${format.height}p`;
  } else if (format.resolution && format.resolution !== "audio only") {
    resolution = format.resolution;
  } else if (format.format_note && format.format_note.match(/^\d+p$/)) {
    resolution = format.format_note;
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

/**
 * Parse and clean error messages for better user feedback
 */
function parseErrorMessage(stderr: string): string {
  // Log stderr for debugging
  console.log("[yt-dlp] stderr output:", stderr.slice(-500));

  // Be more specific with error detection to avoid false positives
  if (stderr.includes("Sign in to confirm you're not a bot") ||
    stderr.includes("Sign in to confirm your age") ||
    stderr.includes("This helps protect our community")) {
    return "YouTube requires sign-in verification. Please update your cookies.txt file with fresh cookies from a logged-in YouTube session.";
  }
  if (stderr.includes("age-restricted") || stderr.includes("age restricted")) {
    return "This content is age-restricted and requires login. Please provide valid cookies.txt with an authenticated YouTube account.";
  }
  if (stderr.includes("Private video")) {
    return "This video is private and cannot be accessed.";
  }
  if (stderr.includes("Video unavailable") || stderr.includes("video is unavailable")) {
    return "This video is unavailable or has been removed.";
  }
  if (stderr.includes("HTTP Error 403") || stderr.includes("403 Forbidden")) {
    return "Access forbidden. The video may be geo-restricted or require authentication.";
  }
  if (stderr.includes("HTTP Error 404")) {
    return "Video not found. Please check the URL.";
  }
  if (stderr.includes("No video formats found") || stderr.includes("no video formats")) {
    return "No downloadable formats found for this video.";
  }
  if (stderr.includes("ENOTFOUND") || stderr.includes("getaddrinfo")) {
    return "Network error. Please check your internet connection.";
  }
  if (stderr.includes("ERROR:")) {
    // Extract the actual error message after ERROR:
    const errorMatch = stderr.match(/ERROR:\s*(.+?)(?:\n|$)/);
    if (errorMatch) {
      return errorMatch[1].trim();
    }
  }
  // Return last 300 chars if no specific match
  return stderr.slice(-300).trim() || "Failed to process the request";
}

export async function analyzeUrl(url: string): Promise<MediaInfo> {
  // Check dependencies first
  if (!checkYtDlpInstalled()) {
    throw new Error("yt-dlp is not installed. Please install it with: pip install yt-dlp (or apt install yt-dlp on Ubuntu)");
  }

  return new Promise((resolve, reject) => {
    const args = [
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--flat-playlist",
      "--no-playlist",
      "--socket-timeout", "30",
      "--retries", "3",
    ];

    // Always add remote-components for YouTube JS challenges
    // This is required for modern YouTube - yt-dlp will handle if deno is not available
    args.push("--remote-components", "ejs:github");

    // Use cookies if available
    const cookiesPath = getCookiesPath();
    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
      console.log(`[yt-dlp] Using cookies from: ${cookiesPath}`);
    }

    args.push(
      "--force-ipv4",
      "--no-check-certificates",
      url,
    );

    const extendedPath = getExtendedPath();

    const ytdlpProcess = spawn("yt-dlp", args, {
      env: { ...process.env, PATH: extendedPath },
      timeout: 60000, // 60 second timeout
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Set a timeout to kill the process if it hangs
    const processTimeout = setTimeout(() => {
      timedOut = true;
      ytdlpProcess.kill("SIGTERM");
    }, 60000);

    ytdlpProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on("close", (code) => {
      clearTimeout(processTimeout);

      if (timedOut) {
        reject(new Error("Request timed out. The server took too long to respond."));
        return;
      }

      // Log debug info
      console.log(`[yt-dlp] Process exited with code: ${code}`);
      if (stderr) {
        console.log(`[yt-dlp] stderr length: ${stderr.length}`);
      }

      if (code !== 0) {
        // Also check stdout for errors (sometimes yt-dlp puts errors there)
        const allOutput = stderr + stdout;
        const errorMsg = parseErrorMessage(allOutput);
        reject(new Error(errorMsg));
        return;
      }

      try {
        const lines = stdout.trim().split("\n");
        if (!lines[0]) {
          reject(new Error("No data received from yt-dlp"));
          return;
        }
        const data = JSON.parse(lines[0]);

        const platform = detectPlatform(url);
        const isPlaylist = data._type === "playlist" || lines.length > 1;

        const formats: MediaFormat[] = (data.formats || []).map(parseFormat);

        const videoFormats = formats.filter(f => f.hasVideo);
        const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);

        const sortedVideo = videoFormats.sort((a, b) => {
          const aHeight = parseInt(a.resolution?.replace("p", "").split("x").pop() || "0");
          const bHeight = parseInt(b.resolution?.replace("p", "").split("x").pop() || "0");
          return bHeight - aHeight;
        });

        const bestVideo = sortedVideo[0];
        const bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

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
        console.error("[yt-dlp] Parse error:", e);
        reject(new Error("Failed to parse media information. The response format may have changed."));
      }
    });

    ytdlpProcess.on("error", (err) => {
      clearTimeout(processTimeout);
      if (err.message.includes("ENOENT")) {
        reject(new Error("yt-dlp command not found. Please install yt-dlp."));
      } else {
        reject(new Error(`yt-dlp error: ${err.message}`));
      }
    });
  });
}

export async function downloadMedia(options: DownloadOptions): Promise<{ outputPath: string; fileSize: number }> {
  const { jobId, url, mode, formatId, resolution, audioFormat, audioBitrate, metadata, onProgress } = options;

  // Check dependencies
  if (!checkYtDlpInstalled()) {
    throw new Error("yt-dlp is not installed. Please install it with: pip install yt-dlp");
  }

  if (mode === "audio" && !checkFfmpegInstalled()) {
    throw new Error("ffmpeg is not installed. It is required for audio extraction. Please install ffmpeg.");
  }

  const ext = mode === "audio" ? (audioFormat || "mp3") : "mp4";
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);

  const args: string[] = [
    "--no-warnings",
    "--newline",
    "--progress",
    "--force-ipv4",
    "--no-check-certificates",
    "--socket-timeout", "30",
    "--retries", "5",
    "--fragment-retries", "5",
    "-o", outputTemplate,
  ];

  // Always add remote-components for YouTube JS challenges
  args.push("--remote-components", "ejs:github");

  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    args.push("--cookies", cookiesPath);
  }

  if (mode === "audio") {
    args.push("-f", "bestaudio/best");
    args.push("-x", "--audio-format", audioFormat || "mp3");
    if (audioBitrate) args.push("--audio-quality", `${audioBitrate}K`);
  } else {
    if (formatId) {
      args.push("-f", `${formatId}+bestaudio/best`);
    } else if (resolution) {
      const height = resolution.replace("p", "");
      args.push("-f", `bestvideo[height<=${height}]+bestaudio/best`);
    } else {
      args.push("-f", "bestvideo+bestaudio/best");
    }
    args.push("--merge-output-format", "mp4");
  }

  args.push(url);

  return new Promise((resolve, reject) => {
    const extendedPath = getExtendedPath();

    const ytdlpProcess = spawn("yt-dlp", args, {
      env: { ...process.env, PATH: extendedPath }
    });

    let lastProgress = 0;
    let allOutput = "";
    let timedOut = false;

    // Set a longer timeout for downloads (30 minutes)
    const processTimeout = setTimeout(() => {
      timedOut = true;
      ytdlpProcess.kill("SIGTERM");
    }, 30 * 60 * 1000);

    ytdlpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      allOutput += output;
      const lines = output.split("\n");
      for (const line of lines) {
        const match = line.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (match) {
          const progress = parseFloat(match[1]);
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress(progress, "downloading");
          }
        }
        if (line.includes("[ExtractAudio]") || line.includes("[Merger]")) {
          onProgress(95, "converting");
        }
      }
    });

    ytdlpProcess.stderr.on("data", (data) => {
      allOutput += data.toString();
    });

    ytdlpProcess.on("close", (code) => {
      clearTimeout(processTimeout);

      if (timedOut) {
        reject(new Error("Download timed out. The file may be too large or the connection is slow."));
        return;
      }

      if (code !== 0) {
        const errorMsg = parseErrorMessage(allOutput);
        reject(new Error(`Download failed: ${errorMsg}`));
        return;
      }

      try {
        const files = fs.readdirSync(DOWNLOAD_DIR);
        const outputFile = files.find(f => f.startsWith(jobId) && !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.temp'));

        if (!outputFile) {
          reject(new Error("Output file not found after download completed"));
          return;
        }

        const stats = fs.statSync(path.join(DOWNLOAD_DIR, outputFile));
        onProgress(100, "downloading");
        resolve({ outputPath: outputFile, fileSize: stats.size });
      } catch (err: any) {
        reject(new Error(`Failed to process output file: ${err.message}`));
      }
    });

    ytdlpProcess.on("error", (err) => {
      clearTimeout(processTimeout);
      if (err.message.includes("ENOENT")) {
        reject(new Error("yt-dlp command not found. Please install yt-dlp."));
      } else {
        reject(new Error(`Download error: ${err.message}`));
      }
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
  } catch (e) {
    console.error("[cleanup] Failed to delete file:", e);
  }
  return false;
}

export function getAvailableResolutions(formats: MediaFormat[]): string[] {
  const resolutions = new Set<string>();
  for (const format of formats) {
    if (format.hasVideo && format.resolution) {
      const heightMatch = format.resolution.match(/(\d+)p?$/) || format.resolution.match(/^(\d+)x/);
      const height = heightMatch ? parseInt(heightMatch[1]) : 0;
      if (height >= 144) {
        if (height >= 4320) resolutions.add("8K");
        else if (height >= 2160) resolutions.add("4K");
        else if (height >= 1440) resolutions.add("1440p");
        else if (height >= 1080) resolutions.add("1080p");
        else if (height >= 720) resolutions.add("720p");
        else if (height >= 480) resolutions.add("480p");
        else if (height >= 360) resolutions.add("360p");
        else if (height >= 144) resolutions.add("240p");
      }
    }
  }
  const orderedRes = ["8K", "4K", "1440p", "1080p", "720p", "480p", "360p", "240p"];
  return Array.from(resolutions).sort((a, b) => orderedRes.indexOf(a) - orderedRes.indexOf(b));
}

/**
 * Health check function to verify all dependencies are available
 */
export function checkDependencies(): { ytdlp: boolean; ffmpeg: boolean; deno: boolean; cookies: boolean } {
  let denoInstalled = false;
  try {
    const denoCmd = isWindows ? "where deno" : "which deno";
    execSync(denoCmd, { stdio: "ignore", env: { ...process.env, PATH: getExtendedPath() } });
    denoInstalled = true;
  } catch {
    denoInstalled = false;
  }

  return {
    ytdlp: checkYtDlpInstalled(),
    ffmpeg: checkFfmpegInstalled(),
    deno: denoInstalled,
    cookies: getCookiesPath() !== null,
  };
}

interface DownloadOptions {
  jobId: string;
  url: string;
  mode: "video" | "audio";
  formatId?: string;
  resolution?: string;
  audioFormat?: AudioFormat;
  audioBitrate?: number;
  metadata?: { title?: string; artist?: string; album?: string; };
  onProgress: (progress: number, stage: "downloading" | "converting") => void;
}
