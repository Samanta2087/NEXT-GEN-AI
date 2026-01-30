import { useState, useCallback, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Link2,
  Loader2,
  Music,
  Video,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Settings2,
  Sparkles,
  ChevronDown,
  FileText
} from "lucide-react";
import { SiYoutube, SiInstagram, SiFacebook } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaInfo, DownloadJob, SupportedPlatform, AudioFormat } from "@shared/schema";

const AUDIO_BITRATES = [64, 128, 192, 320] as const;
const AUDIO_FORMATS: AudioFormat[] = ["mp3", "m4a", "opus"];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const PlatformIcon = memo(function PlatformIcon({ platform, className }: { platform: SupportedPlatform; className?: string }) {
  switch (platform) {
    case "youtube":
      return <SiYoutube className={className} />;
    case "instagram":
      return <SiInstagram className={className} />;
    case "facebook":
      return <SiFacebook className={className} />;
    default:
      return <Link2 className={className} />;
  }
});

function getPlatformColor(platform: SupportedPlatform): string {
  switch (platform) {
    case "youtube":
      return "text-red-500";
    case "instagram":
      return "text-pink-500";
    case "facebook":
      return "text-blue-600";
    default:
      return "text-cyan-600";
  }
}

function getPlatformGradient(platform: SupportedPlatform): string {
  switch (platform) {
    case "youtube":
      return "from-red-500/20 to-red-600/10";
    case "instagram":
      return "from-pink-500/20 via-purple-500/15 to-orange-500/10";
    case "facebook":
      return "from-blue-500/20 to-blue-600/10";
    default:
      return "from-primary/20 to-primary/10";
  }
}

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [availableResolutions, setAvailableResolutions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"video" | "audio">("video");
  const [selectedResolution, setSelectedResolution] = useState<string>("1080p");
  const [audioFormat, setAudioFormat] = useState<AudioFormat>("mp3");
  const [audioBitrate, setAudioBitrate] = useState<number>(192);
  const [useAutoQuality, setUseAutoQuality] = useState(true);

  const [metadata, setMetadata] = useState<{ title: string; artist: string; album: string }>({ title: "", artist: "", album: "" });
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);

  const [downloadQueue, setDownloadQueue] = useState<DownloadJob[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<DownloadJob[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "download_progress") {
          const job = data.job as DownloadJob;
          setDownloadQueue(prev => {
            const existing = prev.find(j => j.id === job.id);
            if (existing) {
              return prev.map(j => j.id === job.id ? job : j);
            }
            return prev;
          });

          if (job.status === "completed" || job.status === "error") {
            setDownloadHistory(prev => [job, ...prev.filter(j => j.id !== job.id)]);
            setDownloadQueue(prev => prev.filter(j => j.id !== job.id));
          }
        }
      } catch (e) {
        console.error("WebSocket parse error:", e);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const analyzeUrl = useCallback(async () => {
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setMediaInfo(null);

    try {
      const response = await fetch("/api/social/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to analyze URL");
      }

      const data = await response.json();
      setMediaInfo(data.mediaInfo);
      setAvailableResolutions(data.availableResolutions || []);

      if (data.availableResolutions?.length > 0) {
        setSelectedResolution(data.availableResolutions[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [url]);

  const startDownload = useCallback(async () => {
    if (!mediaInfo) return;

    const jobId = generateId();

    const newJob: DownloadJob = {
      id: jobId,
      url: mediaInfo.url,
      platform: mediaInfo.platform,
      title: mediaInfo.title,
      thumbnail: mediaInfo.thumbnail,
      duration: mediaInfo.duration,
      status: "pending",
      progress: 0,
      mode,
      selectedResolution: mode === "video" ? selectedResolution : undefined,
      audioFormat: mode === "audio" ? audioFormat : undefined,
      audioBitrate: mode === "audio" ? audioBitrate : undefined,
      createdAt: Date.now(),
    };

    setDownloadQueue(prev => [...prev, newJob]);

    try {
      await fetch("/api/social/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          url: mediaInfo.url,
          platform: mediaInfo.platform,
          title: mediaInfo.title,
          thumbnail: mediaInfo.thumbnail,
          duration: mediaInfo.duration,
          mode,
          resolution: useAutoQuality ? undefined : selectedResolution,
          audioFormat: mode === "audio" ? audioFormat : undefined,
          audioBitrate: mode === "audio" ? audioBitrate : undefined,
        }),
      });
    } catch (err: any) {
      setDownloadQueue(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: "error" as const, errorMessage: err.message } : j
      ));
    }
  }, [mediaInfo, mode, selectedResolution, audioFormat, audioBitrate, useAutoQuality]);

  const getFilenamePreview = useCallback((title: string, ext: string) => {
    return title.replace(/[<>:"/\\|?*]/g, "_").substring(0, 50) + "." + ext;
  }, []);

  const clearHistory = useCallback(() => {
    downloadHistory.forEach(job => {
      if (job.outputPath) {
        fetch(`/api/social/jobs/${job.id}`, { method: "DELETE" }).catch(() => { });
      }
    });
    setDownloadHistory([]);
  }, [downloadHistory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-blue-50/30">
      <div className="relative z-10">

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-primary/20 shadow-sm">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">Social Media Extraction Studio</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary via-accent to-magenta bg-clip-text text-transparent">
                Media Downloader
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Extract videos and audio from YouTube, Instagram, and Facebook with precision control
              </p>
            </div>

            <div className="relative rounded-3xl bg-white/90 backdrop-blur-sm border-2 border-primary/30 shadow-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

              <div className="relative z-10 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                    <Terminal className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground">Command Console</h2>
                    <p className="text-xs text-muted-foreground">Paste any supported URL to begin</p>
                  </div>
                </div>

                <div className="flex gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
                    <span className="text-primary font-mono text-sm">URL</span>
                    <div className="w-px h-4 bg-primary/30" />
                  </div>

                  <Input
                    data-testid="input-social-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && analyzeUrl()}
                    placeholder="https://youtube.com/watch?v=... or instagram.com/reel/..."
                    className="flex-1 border-0 bg-transparent text-lg focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />

                  <Button
                    data-testid="button-analyze-url"
                    onClick={analyzeUrl}
                    disabled={isAnalyzing || !url.trim()}
                    className="px-6 rounded-xl gradient-primary text-white shadow-lg"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-6 mt-6">
                  {(["youtube", "instagram", "facebook"] as SupportedPlatform[]).map((platform) => (
                    <div
                      key={platform}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border ${mediaInfo?.platform === platform
                        ? `border-2 ${getPlatformColor(platform)} bg-gradient-to-r ${getPlatformGradient(platform)}`
                        : "border-slate-200 bg-white/50 opacity-50"
                        }`}
                    >
                      <PlatformIcon platform={platform} className={`w-5 h-5 ${getPlatformColor(platform)}`} />
                      <span className="text-sm font-medium capitalize">{platform}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {mediaInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                  <div className="lg:col-span-1">
                    <div className="rounded-3xl bg-white/90 backdrop-blur-sm border border-primary/20 overflow-hidden shadow-lg">
                      <div className={`relative aspect-video bg-gradient-to-br ${getPlatformGradient(mediaInfo.platform)}`}>
                        {mediaInfo.thumbnail ? (
                          <img
                            src={mediaInfo.thumbnail}
                            alt={mediaInfo.title}
                            className="w-full h-full object-cover"
                            loading="eager"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlatformIcon platform={mediaInfo.platform} className={`w-16 h-16 ${getPlatformColor(mediaInfo.platform)}`} />
                          </div>
                        )}

                        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-2">
                          <PlatformIcon platform={mediaInfo.platform} className={`w-4 h-4 ${getPlatformColor(mediaInfo.platform)}`} />
                          <span className="text-xs font-medium capitalize">{mediaInfo.platform}</span>
                        </div>

                        {mediaInfo.duration && (
                          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/70 text-white text-xs font-mono">
                            {formatDuration(mediaInfo.duration)}
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        <h3 className="font-bold text-foreground line-clamp-2">{mediaInfo.title}</h3>

                        {mediaInfo.uploader && (
                          <p className="text-sm text-muted-foreground">{mediaInfo.uploader}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {mediaInfo.viewCount && (
                            <span>{mediaInfo.viewCount.toLocaleString()} views</span>
                          )}
                          {mediaInfo.uploadDate && (
                            <span>{mediaInfo.uploadDate}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-3xl bg-white/90 backdrop-blur-sm border border-primary/20 p-6 shadow-lg">

                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <Settings2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">Download Mode</h3>
                          <p className="text-xs text-muted-foreground">Choose your extraction type</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <Button
                          data-testid="button-mode-video"
                          variant="outline"
                          onClick={() => setMode("video")}
                          className={`relative flex-col items-start gap-2 rounded-2xl border-2 ${mode === "video"
                            ? "border-primary bg-primary/10"
                            : "border-white/20 bg-white/50"
                            }`}
                        >
                          <Video className={`w-8 h-8 ${mode === "video" ? "text-cyan-600" : "text-muted-foreground"}`} />
                          <h4 className="font-bold text-foreground">Video</h4>
                          <p className="text-xs text-muted-foreground">Full video with audio</p>

                          {mode === "video" && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle className="w-5 h-5 text-cyan-600" />
                            </div>
                          )}
                        </Button>

                        <Button
                          data-testid="button-mode-audio"
                          variant="outline"
                          onClick={() => setMode("audio")}
                          className={`relative flex-col items-start gap-2 rounded-2xl border-2 ${mode === "audio"
                            ? "border-accent bg-accent/10"
                            : "border-white/20 bg-white/50"
                            }`}
                        >
                          <Music className={`w-8 h-8 ${mode === "audio" ? "text-accent" : "text-muted-foreground"}`} />
                          <h4 className="font-bold text-foreground">Audio Only</h4>
                          <p className="text-xs text-muted-foreground">Extract audio track</p>

                          {mode === "audio" && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle className="w-5 h-5 text-accent" />
                            </div>
                          )}
                        </Button>
                      </div>

                      <AnimatePresence mode="wait">
                        {mode === "video" && (
                          <motion.div
                            key="video-options"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-foreground flex items-center gap-2">
                                <Settings2 className="w-4 h-4" />
                                Quality Settings
                              </h4>

                              <Button
                                data-testid="button-auto-quality"
                                variant={useAutoQuality ? "default" : "outline"}
                                size="sm"
                                onClick={() => setUseAutoQuality(!useAutoQuality)}
                              >
                                {useAutoQuality ? "Auto (Best)" : "Manual"}
                              </Button>
                            </div>

                            {!useAutoQuality && (
                              <div className="grid grid-cols-4 gap-2">
                                {availableResolutions.map((res) => (
                                  <Button
                                    key={res}
                                    data-testid={`button-resolution-${res}`}
                                    variant={selectedResolution === res ? "default" : "outline"}
                                    onClick={() => setSelectedResolution(res)}
                                    className="rounded-xl"
                                  >
                                    <span className="font-bold">{res}</span>
                                  </Button>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}

                        {mode === "audio" && (
                          <motion.div
                            key="audio-options"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4"
                          >
                            <div>
                              <h4 className="font-medium text-foreground mb-3">Audio Format</h4>
                              <div className="grid grid-cols-3 gap-2">
                                {AUDIO_FORMATS.map((format) => (
                                  <Button
                                    key={format}
                                    data-testid={`button-format-${format}`}
                                    variant={audioFormat === format ? "default" : "outline"}
                                    onClick={() => setAudioFormat(format)}
                                    className={`rounded-xl uppercase font-bold ${audioFormat === format ? "bg-accent border-accent" : ""}`}
                                  >
                                    {format}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-foreground mb-3">Bitrate</h4>
                              <div className="grid grid-cols-4 gap-2">
                                {AUDIO_BITRATES.map((bitrate) => (
                                  <Button
                                    key={bitrate}
                                    data-testid={`button-bitrate-${bitrate}`}
                                    variant={audioBitrate === bitrate ? "default" : "outline"}
                                    onClick={() => setAudioBitrate(bitrate)}
                                    className={`rounded-xl ${audioBitrate === bitrate ? "bg-accent border-accent" : ""}`}
                                  >
                                    <span className="font-bold">{bitrate}</span>
                                    <span className="text-xs opacity-70 ml-1">kbps</span>
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {mode === "audio" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 p-4 rounded-2xl bg-accent/5 border border-accent/20"
                        >
                          <Button
                            data-testid="button-toggle-metadata"
                            variant="ghost"
                            onClick={() => setShowMetadataEditor(!showMetadataEditor)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Settings2 className="w-4 h-4 text-accent" />
                              <span className="font-medium text-foreground">Metadata Editor</span>
                              <span className="text-xs text-muted-foreground">(Optional)</span>
                            </div>
                            <motion.div
                              animate={{ rotate: showMetadataEditor ? 180 : 0 }}
                              className="text-accent"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </Button>

                          <AnimatePresence>
                            {showMetadataEditor && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 space-y-3"
                              >
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                                  <Input
                                    value={metadata.title}
                                    onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder={mediaInfo?.title || "Enter title..."}
                                    className="bg-white/70"
                                    data-testid="input-metadata-title"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">Artist</label>
                                  <Input
                                    value={metadata.artist}
                                    onChange={(e) => setMetadata(prev => ({ ...prev, artist: e.target.value }))}
                                    placeholder={mediaInfo?.uploader || "Enter artist..."}
                                    className="bg-white/70"
                                    data-testid="input-metadata-artist"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">Album</label>
                                  <Input
                                    value={metadata.album}
                                    onChange={(e) => setMetadata(prev => ({ ...prev, album: e.target.value }))}
                                    placeholder="Enter album..."
                                    className="bg-white/70"
                                    data-testid="input-metadata-album"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}

                      <div className="mt-4 p-3 rounded-xl bg-white/50 border border-white/30">
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Filename:</span>
                          <span className="font-mono text-foreground truncate">
                            {getFilenamePreview(metadata.title || mediaInfo?.title || "file", mode === "audio" ? audioFormat : "mp4")}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Button
                          data-testid="button-start-download"
                          onClick={startDownload}
                          className="w-full gradient-primary text-white border-0 py-6 text-lg font-bold"
                        >
                          <Download className="w-6 h-6 mr-2" />
                          Download Now
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {downloadQueue.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl glass-strong border border-primary/20 p-6"
              >
                <div className="noise" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Active Downloads</h3>
                    <p className="text-xs text-muted-foreground">{downloadQueue.length} in progress</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {downloadQueue.map((job) => (
                    <motion.div
                      key={job.id}
                      className="p-4 rounded-2xl bg-white/50 border border-white/30"
                      layout
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          {job.thumbnail ? (
                            <img src={job.thumbnail} alt={job.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PlatformIcon platform={job.platform} className={`w-8 h-8 ${getPlatformColor(job.platform)}`} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{job.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span className="capitalize">{job.mode}</span>
                            <span>•</span>
                            <span className="capitalize">{job.status}</span>
                          </div>

                          <div className="mt-3">
                            <div className="relative h-2 rounded-full overflow-hidden bg-primary/10">
                              <motion.div
                                className="absolute inset-y-0 left-0 gradient-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${job.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />

                              {job.status === "converting" && (
                                <motion.div
                                  className="absolute inset-y-0 left-0 bg-accent/50 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${job.convertProgress || 0}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              )}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>{job.progress}%</span>
                              <span>{job.status === "converting" ? "Converting..." : "Downloading..."}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {downloadHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl glass-strong border border-primary/20 p-6"
              >
                <div className="noise" />

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-lime-500 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Download History</h3>
                      <p className="text-xs text-muted-foreground">{downloadHistory.length} completed</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>

                <div className="space-y-3">
                  {downloadHistory.map((job) => (
                    <motion.div
                      key={job.id}
                      className={`p-4 rounded-2xl border ${job.status === "completed"
                        ? "bg-accent/5 border-accent/20"
                        : "bg-red-500/5 border-red-500/20"
                        }`}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          {job.thumbnail ? (
                            <img src={job.thumbnail} alt={job.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PlatformIcon platform={job.platform} className={`w-6 h-6 ${getPlatformColor(job.platform)}`} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{job.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span className="capitalize">{job.mode}</span>
                            {job.fileSize && (
                              <>
                                <span>•</span>
                                <span>{formatFileSize(job.fileSize)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {job.status === "completed" ? (
                          <Button
                            data-testid={`link-download-${job.id}`}
                            asChild
                            className="bg-accent text-white"
                          >
                            <a href={`/api/social/download/${job.id}`}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        ) : (
                          <div data-testid={`status-failed-${job.id}`} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 text-sm">
                            Failed
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
