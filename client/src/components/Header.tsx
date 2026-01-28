import { motion } from "framer-motion";
import { Music, Sparkles, Zap, Download, ArrowLeft, Image, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  showBackToConverter?: boolean;
  showDownloaderLink?: boolean;
}

export function Header({ showBackToConverter, showDownloaderLink = true }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative py-8 text-center"
    >
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ 
          background: "radial-gradient(ellipse, hsla(195, 100%, 50%, 0.3), transparent 70%)" 
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {showBackToConverter && (
        <div className="absolute top-4 left-4 z-20">
          <Link href="/">
            <Button
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-foreground"
              data-testid="button-back-to-converter"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Converter
            </Button>
          </Link>
        </div>
      )}

      <div className="relative z-10 space-y-4">
        <motion.div
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full glass border border-primary/20"
          whileHover={{ scale: 1.05 }}
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </motion.div>
          <span className="text-sm font-medium text-muted-foreground">
            Next-Gen Audio Extraction
          </span>
          <Zap className="w-4 h-4 text-accent" />
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
            Video to{" "}
          </span>
          <span className="relative">
            <span className="bg-gradient-to-r from-primary via-neon-blue to-accent bg-clip-text text-transparent">
              MP3
            </span>
            <motion.span
              className="absolute -bottom-1 left-0 right-0 h-1 rounded-full gradient-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            />
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Transform your videos into crystal-clear audio with our 
          <span className="text-primary font-medium"> studio-grade </span>
          conversion engine
        </p>

        <div className="flex items-center justify-center gap-6 pt-4">
          {[
            { label: "High Quality", icon: "320kbps" },
            { label: "Batch Convert", icon: "50+" },
            { label: "Lightning Fast", icon: "10x" },
          ].map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-2 text-sm"
            >
              <div className="px-2 py-1 rounded-md bg-primary/10 font-mono font-bold text-primary">
                {feature.icon}
              </div>
              <span className="text-muted-foreground">{feature.label}</span>
            </motion.div>
          ))}
        </div>

        {showDownloaderLink && !showBackToConverter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="pt-6 flex flex-wrap items-center justify-center gap-4"
          >
            <Link href="/downloader">
              <Button
                variant="outline"
                className="gap-2 px-6 py-3 rounded-xl border-2 border-magenta/30 bg-magenta/5 text-magenta font-medium"
                data-testid="button-go-to-downloader"
              >
                <Download className="w-5 h-5" />
                Social Media Downloader
              </Button>
            </Link>
            <Link href="/tools">
              <Button
                variant="outline"
                className="gap-2 px-6 py-3 rounded-xl border-2 border-primary/30 bg-primary/5 text-cyan-600 font-medium"
                data-testid="button-go-to-tools"
              >
                <Image className="w-5 h-5" />
                Image & PDF Tools
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-xs font-bold">NEW</span>
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}
