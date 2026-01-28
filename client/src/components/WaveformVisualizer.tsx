import { useEffect, useState, useRef, useMemo } from "react";
import { motion } from "framer-motion";

interface WaveformVisualizerProps {
  isPlaying?: boolean;
  progress?: number;
  isBuilding?: boolean;
  buildProgress?: number;
  barCount?: number;
  height?: number;
  colorScheme?: "primary" | "accent" | "lime";
}

export function WaveformVisualizer({
  isPlaying = false,
  progress = 0,
  isBuilding = false,
  buildProgress = 100,
  barCount = 60,
  height = 80,
  colorScheme = "primary",
}: WaveformVisualizerProps) {
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number>();

  const colorClasses = {
    primary: {
      active: "from-primary to-neon-blue",
      inactive: "from-primary/30 to-neon-blue/30",
    },
    accent: {
      active: "from-accent to-neon-magenta",
      inactive: "from-accent/30 to-neon-magenta/30",
    },
    lime: {
      active: "from-neon-lime to-emerald-400",
      inactive: "from-neon-lime/30 to-emerald-400/30",
    },
  };

  const colors = colorClasses[colorScheme];

  const staticBars = useMemo(() => {
    return Array.from({ length: barCount }, () => 
      0.2 + Math.random() * 0.8
    );
  }, [barCount]);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setBars(prev => 
          prev.map((bar, i) => {
            const baseHeight = staticBars[i];
            const variation = Math.sin(Date.now() / 200 + i * 0.3) * 0.3;
            return Math.max(0.15, Math.min(1, baseHeight + variation));
          })
        );
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      setBars(staticBars);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, staticBars]);

  useEffect(() => {
    if (!isPlaying) {
      setBars(staticBars);
    }
  }, [staticBars, isPlaying]);

  const visibleBarCount = isBuilding 
    ? Math.floor((buildProgress / 100) * barCount) 
    : barCount;

  return (
    <div 
      className="relative flex items-center justify-center gap-[2px] px-2"
      style={{ height }}
    >
      {(bars.length > 0 ? bars : staticBars).slice(0, visibleBarCount).map((barHeight, index) => {
        const isActive = (index / barCount) * 100 <= progress;
        const barIndex = index / barCount;
        
        return (
          <motion.div
            key={index}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ 
              scaleY: barHeight,
              opacity: isBuilding && index >= visibleBarCount - 3 ? 0.5 : 1,
            }}
            transition={{ 
              duration: isBuilding ? 0.1 : 0.15,
              delay: isBuilding ? index * 0.01 : 0,
              ease: "easeOut"
            }}
            className={`
              w-1 rounded-full origin-center
              bg-gradient-to-t ${isActive ? colors.active : colors.inactive}
              ${isPlaying && isActive ? "shadow-glow-cyan" : ""}
            `}
            style={{
              height: height * 0.8,
              minHeight: 4,
            }}
          />
        );
      })}

      {isBuilding && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background via-background/50 to-transparent"
          animate={{ x: [(barCount - visibleBarCount) * 6, 0] }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
}

export function WaveformLoading({ barCount = 40 }: { barCount?: number }) {
  return (
    <div className="flex items-center justify-center gap-[2px] h-16 px-4">
      {Array.from({ length: barCount }).map((_, index) => (
        <motion.div
          key={index}
          className="w-1 rounded-full bg-gradient-to-t from-primary/40 to-primary/20"
          animate={{
            scaleY: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.02,
            ease: "easeInOut",
          }}
          style={{
            height: 48,
            originY: 0.5,
          }}
        />
      ))}
    </div>
  );
}
