import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  className = "",
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;

    setSliderPosition(percentage);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      onMouseDown={(e) => {
        handleMove(e.clientX);
        handleMouseDown();
      }}
      onTouchStart={(e) => {
        handleMove(e.touches[0].clientX);
        handleMouseDown();
      }}
    >
      {/* Before Image (Background) */}
      <div className="absolute inset-0">
        <img
          src={beforeImage}
          alt="Before"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-sm font-semibold border border-white/20">
          Original
        </div>
      </div>

      {/* After Image (Foreground) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={afterImage}
          alt="After"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold shadow-lg border border-white/20">
          Processed
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute top-0 bottom-0 w-1 cursor-ew-resize"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Line */}
        <div className="absolute inset-0 bg-white shadow-lg" />

        {/* Handle */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-2xl flex items-center justify-center cursor-grab active:cursor-grabbing border-3 border-blue-500"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <GripVertical className="w-6 h-6 text-blue-600" />
        </motion.div>

        {/* Side Lines */}
        <div className="absolute top-0 bottom-0 -left-px w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-50" />
        <div className="absolute top-0 bottom-0 -right-px w-px bg-gradient-to-b from-transparent via-white to-transparent opacity-50" />
      </div>

      {/* Percentage Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-mono border border-white/20">
        {sliderPosition.toFixed(0)}%
      </div>
    </div>
  );
}
