import { motion } from "framer-motion";
import { Zap, Music2, Headphones, Star } from "lucide-react";
import { AUDIO_BITRATES, type VideoBitrate } from "@shared/schema";

interface BitrateSelectorProps {
  value: VideoBitrate;
  onChange: (value: VideoBitrate) => void;
}

const bitrateInfo: Record<VideoBitrate, { label: string; desc: string; icon: any; quality: string }> = {
  64: { label: "64 kbps", desc: "Compact", icon: Zap, quality: "Low" },
  128: { label: "128 kbps", desc: "Standard", icon: Music2, quality: "Good" },
  192: { label: "192 kbps", desc: "High", icon: Headphones, quality: "Great" },
  320: { label: "320 kbps", desc: "Maximum", icon: Star, quality: "Best" },
};

export function BitrateSelector({ value, onChange }: BitrateSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-muted-foreground">Audio Quality</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {AUDIO_BITRATES.map((bitrate) => {
          const info = bitrateInfo[bitrate];
          const Icon = info.icon;
          const isSelected = value === bitrate;

          return (
            <motion.button
              key={bitrate}
              type="button"
              onClick={() => onChange(bitrate)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative p-4 rounded-xl text-left transition-all duration-300
                ${isSelected 
                  ? "glass-strong border-2 border-primary/50 shadow-glow-cyan" 
                  : "glass border border-white/40 hover:border-primary/30"
                }
              `}
              data-testid={`button-bitrate-${bitrate}`}
            >
              <div className="space-y-2">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${isSelected ? "gradient-primary" : "bg-primary/10"}
                `}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-white" : "text-primary"}`} />
                </div>
                <div>
                  <p className="font-bold text-foreground">{info.label}</p>
                  <p className="text-xs text-muted-foreground">{info.desc}</p>
                </div>
              </div>

              {isSelected && (
                <motion.div
                  layoutId="bitrate-indicator"
                  className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full text-xs font-medium gradient-primary text-white"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {info.quality}
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
