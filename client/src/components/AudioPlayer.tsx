import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Pause, Volume2, VolumeX, Download, SkipBack, SkipForward,
  Repeat, Music2, Disc
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WaveformVisualizer } from "./WaveformVisualizer";
import type { ConversionJob } from "@shared/schema";

interface AudioPlayerProps {
  job: ConversionJob;
  audioUrl: string;
  onDownload: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ job, audioUrl, onDownload }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (!isLooping) setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [isLooping]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  }, []);

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value[0];
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  }, [currentTime, duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl glass-strong border border-white/40 shadow-float"
    >
      <div className="noise" />
      
      <audio ref={audioRef} src={audioUrl} loop={isLooping} preload="metadata" />

      <div className="relative z-10">
        <div className="p-6 pb-4">
          <div className="flex items-start gap-6">
            <motion.div
              className={`
                relative w-20 h-20 rounded-2xl overflow-hidden shrink-0
                ${isPlaying ? "shadow-glow-cyan" : ""}
              `}
              animate={isPlaying ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="absolute inset-0 gradient-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : {}}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Disc className="w-10 h-10 text-white/80" />
                </motion.div>
              </div>
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"
                  animate={{ opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>

            <div className="flex-1 min-w-0 space-y-1">
              <h3 className="font-bold text-lg text-foreground truncate">
                {job.metadata?.title || job.originalName.replace(/\.[^/.]+$/, "")}
              </h3>
              {job.metadata?.artist && (
                <p className="text-muted-foreground">{job.metadata.artist}</p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Music2 className="w-4 h-4" />
                <span className="font-mono">{job.bitrate}kbps MP3</span>
              </div>
            </div>

            <Button
              size="lg"
              onClick={onDownload}
              className="gradient-success text-white shadow-lg shadow-neon-lime/25"
              data-testid="button-download-audio"
            >
              <Download className="w-5 h-5 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <div className="px-6">
          <WaveformVisualizer
            isPlaying={isPlaying}
            progress={progress}
            height={60}
            barCount={80}
            colorScheme="primary"
          />
        </div>

        <div className="px-6 py-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            data-testid="slider-audio-seek"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 pt-2">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="hover:bg-primary/10"
              data-testid="button-toggle-mute"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
              data-testid="slider-volume"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => skip(-10)}
              className="hover:bg-primary/10"
              data-testid="button-skip-back"
            >
              <SkipBack className="w-5 h-5" />
            </Button>

            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                size="lg"
                onClick={togglePlay}
                className={`
                  w-14 h-14 rounded-full gradient-primary text-white
                  shadow-lg shadow-primary/30
                `}
                data-testid="button-play-pause"
              >
                <AnimatePresence mode="wait">
                  {isPlaying ? (
                    <motion.div
                      key="pause"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 90 }}
                    >
                      <Pause className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="play"
                      initial={{ scale: 0, rotate: 90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: -90 }}
                    >
                      <Play className="w-6 h-6 ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => skip(10)}
              className="hover:bg-primary/10"
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>

          <div>
            <Button
              size="icon"
              variant={isLooping ? "secondary" : "ghost"}
              onClick={() => setIsLooping(!isLooping)}
              className={isLooping ? "text-primary" : "hover:bg-primary/10"}
              data-testid="button-toggle-loop"
            >
              <Repeat className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
