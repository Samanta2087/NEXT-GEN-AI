import { motion } from "framer-motion";

interface FloatingOrbProps {
  color: "cyan" | "magenta" | "lime" | "blue";
  size: "sm" | "md" | "lg";
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}

const colorMap = {
  cyan: "from-primary to-neon-blue",
  magenta: "from-neon-magenta to-accent",
  lime: "from-neon-lime to-emerald-400",
  blue: "from-neon-blue to-primary",
};

const sizeMap = {
  sm: "w-24 h-24",
  md: "w-40 h-40",
  lg: "w-64 h-64",
};

export function FloatingOrb({ color, size, position, delay = 0 }: FloatingOrbProps) {
  return (
    <motion.div
      className={`
        absolute rounded-full opacity-20 blur-3xl pointer-events-none
        bg-gradient-to-br ${colorMap[color]} ${sizeMap[size]}
      `}
      style={position}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

export function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <FloatingOrb color="cyan" size="lg" position={{ top: "-5%", left: "-5%" }} delay={0} />
      <FloatingOrb color="magenta" size="md" position={{ top: "20%", right: "-3%" }} delay={2} />
      <FloatingOrb color="lime" size="sm" position={{ bottom: "30%", left: "5%" }} delay={4} />
      <FloatingOrb color="blue" size="md" position={{ bottom: "-5%", right: "10%" }} delay={1} />
      <FloatingOrb color="cyan" size="sm" position={{ top: "60%", right: "20%" }} delay={3} />
      
      <div className="absolute inset-0 gradient-mesh opacity-50" />
    </div>
  );
}
