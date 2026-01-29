import { memo } from "react";
import { Music, Sparkles, Zap, Download, ArrowLeft, Image, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/useDevice";

interface HeaderProps {
  showBackToConverter?: boolean;
  showDownloaderLink?: boolean;
}

// Memoized header to prevent unnecessary re-renders
export const Header = memo(function Header({ showBackToConverter, showDownloaderLink = true }: HeaderProps) {
  const { isMobile, prefersReducedMotion } = useDevice();
  
  return (
    <header className={`relative ${isMobile ? 'py-4 px-4' : 'py-8'} text-center`}>
      {/* Decorative gradient - hidden on mobile for performance */}
      {!isMobile && !prefersReducedMotion && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ 
            background: "radial-gradient(ellipse, hsla(195, 100%, 50%, 0.3), transparent 70%)" 
          }}
        />
      )}

      {showBackToConverter && (
        <div className="absolute top-4 left-4 z-20">
          <Link href="/">
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "default"}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              {!isMobile && "Back to Converter"}
            </Button>
          </Link>
        </div>
      )}

      <div className="relative z-10 space-y-3">
        {/* Badge - smaller on mobile */}
        <div className={`inline-flex items-center gap-2 ${isMobile ? 'px-3 py-1.5' : 'px-5 py-2'} rounded-full bg-white/80 border border-primary/20`}>
          <Sparkles className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-primary`} />
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
            {isMobile ? 'Audio Extraction' : 'Next-Gen Audio Extraction'}
          </span>
          <Zap className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-accent`} />
        </div>

        {/* Title - responsive sizing */}
        <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl md:text-6xl'} font-bold tracking-tight`}>
          <span className="text-foreground">Video to </span>
          <span className="bg-gradient-to-r from-primary via-blue-500 to-purple-600 bg-clip-text text-transparent">
            MP3
          </span>
        </h1>

        {/* Subtitle - shortened on mobile */}
        <p className={`${isMobile ? 'text-sm px-4' : 'text-lg md:text-xl'} text-muted-foreground max-w-2xl mx-auto`}>
          {isMobile 
            ? 'Studio-grade audio conversion' 
            : 'Transform your videos into crystal-clear audio with our studio-grade conversion engine'
          }
        </p>

        {/* Features - hidden on mobile */}
        {!isMobile && (
          <div className="flex items-center justify-center gap-6 pt-4">
            {[
              { label: "High Quality", icon: "320kbps" },
              { label: "Batch Convert", icon: "50+" },
              { label: "Lightning Fast", icon: "10x" },
            ].map((feature) => (
              <div key={feature.label} className="flex items-center gap-2 text-sm">
                <div className="px-2 py-1 rounded-md bg-primary/10 font-mono font-bold text-primary">
                  {feature.icon}
                </div>
                <span className="text-muted-foreground">{feature.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Navigation links */}
        {showDownloaderLink && !showBackToConverter && (
          <div className={`${isMobile ? 'pt-3' : 'pt-6'} flex flex-wrap items-center justify-center gap-2`}>
            <Link href="/downloader">
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                className={`gap-1.5 ${isMobile ? 'px-3 py-2 text-xs' : 'px-6 py-3'} rounded-xl border-2 border-purple-300 bg-purple-50 text-purple-600 font-medium`}
              >
                <Download className={`${isMobile ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
                {isMobile ? 'Downloader' : 'Social Media Downloader'}
              </Button>
            </Link>
            <Link href="/tools">
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                className={`gap-1.5 ${isMobile ? 'px-3 py-2 text-xs' : 'px-6 py-3'} rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-600 font-medium`}
              >
                <Image className={`${isMobile ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
                {isMobile ? 'Tools' : 'Image & PDF Tools'}
                <span className={`${isMobile ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} rounded-full bg-blue-200/50 font-bold`}>NEW</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
});
