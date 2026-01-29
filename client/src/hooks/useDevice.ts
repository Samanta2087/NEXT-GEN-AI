import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
  isLowEnd: boolean; // Heuristic for low-performance devices
  prefersReducedMotion: boolean;
  connectionType: 'slow' | 'fast' | 'unknown';
}

// Breakpoints matching Tailwind defaults
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenWidth: 1920,
      screenHeight: 1080,
      isLandscape: true,
      isLowEnd: false,
      prefersReducedMotion: false,
      connectionType: 'fast',
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Detect low-end device heuristics
  const nav = navigator as any;
  const hardwareConcurrency = nav.hardwareConcurrency || 4;
  const deviceMemory = nav.deviceMemory || 4; // GB
  const isLowEnd = hardwareConcurrency <= 2 || deviceMemory <= 2;
  
  // Motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // Connection type
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  let connectionType: 'slow' | 'fast' | 'unknown' = 'unknown';
  if (connection) {
    const effectiveType = connection.effectiveType;
    connectionType = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g' 
      ? 'slow' 
      : 'fast';
  }

  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isTouchDevice,
    screenWidth: width,
    screenHeight: height,
    isLandscape: width > height,
    isLowEnd,
    prefersReducedMotion,
    connectionType,
  };
}

export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // Debounced resize handler
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDeviceInfo(getDeviceInfo());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}

// Throttled progress hook for mobile
export function useThrottledProgress(value: number, throttleMs: number = 100): number {
  const [throttledValue, setThrottledValue] = useState(value);
  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setThrottledValue(value);
    }, throttleMs);
    
    return () => clearTimeout(timeoutId);
  }, [value, throttleMs]);
  
  return throttledValue;
}

// Performance-aware animation config
export function useAnimationConfig() {
  const { prefersReducedMotion, isLowEnd, isMobile, connectionType } = useDevice();
  
  return useMemo(() => {
    // Disable or reduce animations for performance
    const shouldReduceMotion = prefersReducedMotion || isLowEnd || connectionType === 'slow';
    
    return {
      // Base animation duration (shorter on mobile/low-end)
      duration: shouldReduceMotion ? 0 : (isMobile ? 0.15 : 0.2),
      // Whether to use spring animations
      useSpring: !shouldReduceMotion && !isMobile,
      // Stagger delay for lists
      staggerDelay: shouldReduceMotion ? 0 : (isMobile ? 0.02 : 0.05),
      // Enable/disable animations entirely
      enableAnimations: !shouldReduceMotion,
      // Framer motion variants
      variants: {
        initial: shouldReduceMotion ? {} : { opacity: 0, y: 10 },
        animate: shouldReduceMotion ? {} : { opacity: 1, y: 0 },
        exit: shouldReduceMotion ? {} : { opacity: 0, y: -10 },
      },
      // Transition config
      transition: shouldReduceMotion 
        ? { duration: 0 } 
        : { duration: isMobile ? 0.15 : 0.2, ease: 'easeOut' },
    };
  }, [prefersReducedMotion, isLowEnd, isMobile, connectionType]);
}

// Context for device info (avoid prop drilling)
const DeviceContext = createContext<DeviceInfo | null>(null);

export const DeviceProvider = DeviceContext.Provider;

export function useDeviceContext(): DeviceInfo {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDeviceContext must be used within DeviceProvider');
  }
  return context;
}

// Breakpoint hook
export function useBreakpoint() {
  const { screenWidth } = useDevice();
  
  return useMemo(() => ({
    isSm: screenWidth >= BREAKPOINTS.sm,
    isMd: screenWidth >= BREAKPOINTS.md,
    isLg: screenWidth >= BREAKPOINTS.lg,
    isXl: screenWidth >= BREAKPOINTS.xl,
    current: screenWidth < BREAKPOINTS.sm ? 'xs' 
      : screenWidth < BREAKPOINTS.md ? 'sm'
      : screenWidth < BREAKPOINTS.lg ? 'md'
      : screenWidth < BREAKPOINTS.xl ? 'lg'
      : 'xl',
  }), [screenWidth]);
}
