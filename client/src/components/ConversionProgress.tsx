import { motion } from "framer-motion";
import { Loader2, Music } from "lucide-react";
import { WaveformLoading } from "./WaveformVisualizer";

interface ConversionProgressProps {
  progress: number;
  fileName: string;
}

export function ConversionProgress({ progress, fileName }: ConversionProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl glass-strong border-2 border-primary/30 shadow-glow-cyan"
    >
      <div className="noise" />

      <motion.div
        className="absolute inset-0 gradient-primary opacity-5"
        animate={{
          opacity: [0.05, 0.1, 0.05],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <div className="relative z-10 p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <motion.div
            className="relative"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute -inset-4 rounded-full border-2 border-dashed border-primary/30" />
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow-cyan">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Music className="w-10 h-10 text-white" />
              </motion.div>
            </div>
          </motion.div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Converting to MP3</h3>
            <p className="text-muted-foreground truncate max-w-xs">{fileName}</p>
          </div>

          <div className="w-full max-w-md">
            <WaveformLoading barCount={50} />
          </div>

          <div className="w-full max-w-md space-y-2">
            <div className="relative h-3 rounded-full overflow-hidden bg-primary/10">
              <motion.div
                className="absolute inset-y-0 left-0 gradient-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
              <div className="absolute inset-0 animate-progress-stripe opacity-30" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-primary font-bold">{progress}%</span>
              <span className="text-muted-foreground">
                {progress < 30 && "Extracting audio..."}
                {progress >= 30 && progress < 70 && "Encoding MP3..."}
                {progress >= 70 && progress < 100 && "Finalizing..."}
                {progress === 100 && "Complete!"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
