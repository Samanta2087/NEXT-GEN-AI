import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Scissors, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { WaveformVisualizer } from "./WaveformVisualizer";
import type { ConversionJob } from "@shared/schema";

interface AudioTrimmerProps {
  job: ConversionJob;
  isOpen: boolean;
  onClose: () => void;
  onSave: (trimStart: number, trimEnd: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export function AudioTrimmer({ job, isOpen, onClose, onSave }: AudioTrimmerProps) {
  const duration = job.duration || 180;
  const [range, setRange] = useState<[number, number]>([
    job.trimStart || 0,
    job.trimEnd || duration,
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(range[0]);

  const handleRangeChange = useCallback((values: number[]) => {
    setRange([values[0], values[1]]);
    if (currentTime < values[0] || currentTime > values[1]) {
      setCurrentTime(values[0]);
    }
  }, [currentTime]);

  const handleReset = () => {
    setRange([0, duration]);
    setCurrentTime(0);
  };

  const handleSave = () => {
    onSave(range[0], range[1]);
    onClose();
  };

  const trimmedDuration = range[1] - range[0];
  const progress = ((currentTime - range[0]) / trimmedDuration) * 100;

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + 0.1;
        if (next >= range[1]) {
          setIsPlaying(false);
          return range[0];
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, range]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-white/40 max-w-2xl">
        <div className="noise" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg gradient-primary">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            Trim Audio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              {job.originalName}
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4">
            <WaveformVisualizer
              isPlaying={isPlaying}
              progress={progress}
              height={80}
              barCount={100}
              colorScheme="primary"
            />
            
            <div 
              className="absolute top-0 left-0 bottom-0 bg-black/10 pointer-events-none transition-all"
              style={{ width: `${(range[0] / duration) * 100}%` }}
            />
            <div 
              className="absolute top-0 right-0 bottom-0 bg-black/10 pointer-events-none transition-all"
              style={{ width: `${100 - (range[1] / duration) * 100}%` }}
            />
          </div>

          <div className="px-4">
            <Slider
              value={range}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={handleRangeChange}
              className="cursor-pointer"
              data-testid="slider-trim-range"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Start</p>
              <p className="font-mono font-bold text-primary">{formatTime(range[0])}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Duration</p>
              <p className="font-mono font-bold">{formatTime(trimmedDuration)}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">End</p>
              <p className="font-mono font-bold text-accent">{formatTime(range[1])}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button
              size="icon"
              variant="outline"
              onClick={handleReset}
              className="glass"
              data-testid="button-reset-trim"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                size="lg"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full gradient-primary text-white shadow-lg"
                data-testid="button-preview-trim"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>
            </motion.div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 glass"
              data-testid="button-cancel-trim"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 gradient-accent text-white"
              data-testid="button-apply-trim"
            >
              <Scissors className="w-4 h-4 mr-2" />
              Apply Trim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
