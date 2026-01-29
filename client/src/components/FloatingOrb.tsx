import { memo } from "react";
import { useDevice } from "@/hooks/useDevice";

interface FloatingOrbProps {
  color: "cyan" | "magenta" | "lime" | "blue";
  size: "sm" | "md" | "lg";
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}

const colorMap = {
  cyan: "from-blue-400 to-cyan-400",
  magenta: "from-purple-400 to-pink-400",
  lime: "from-green-400 to-emerald-400",
  blue: "from-blue-500 to-blue-400",
};

const sizeMap = {
  sm: "w-24 h-24",
  md: "w-40 h-40",
  lg: "w-64 h-64",
};

// Memoized and device-aware - disabled on mobile for performance
export const FloatingOrb = memo(function FloatingOrb({ color, size, position, delay = 0 }: FloatingOrbProps) {
  const { isMobile, prefersReducedMotion, isLowEnd } = useDevice();
  
  // Don't render on mobile, low-end devices, or when reduced motion is preferred
  if (isMobile || prefersReducedMotion || isLowEnd) {
    return null;
  }
  
  return (
    <div
      className={`
        absolute rounded-full opacity-15 blur-3xl pointer-events-none
        bg-gradient-to-br ${colorMap[color]} ${sizeMap[size]}
        animate-float
      `}
      style={{
        ...position,
        animationDelay: `${delay}s`,
        animationDuration: '8s',
      }}
    />
  );
});

export const BackgroundOrbs = memo(function BackgroundOrbs() {
  const { isMobile, prefersReducedMotion, isLowEnd } = useDevice();
  
  // Don't render decorative orbs on mobile/low-end for performance
  if (isMobile || prefersReducedMotion || isLowEnd) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <FloatingOrb color="cyan" size="lg" position={{ top: "-5%", left: "-5%" }} delay={0} />
      <FloatingOrb color="magenta" size="md" position={{ top: "20%", right: "-3%" }} delay={2} />
      <FloatingOrb color="lime" size="sm" position={{ bottom: "30%", left: "5%" }} delay={4} />
      <FloatingOrb color="blue" size="md" position={{ bottom: "-5%", right: "10%" }} delay={1} />
    </div>
  );
});
