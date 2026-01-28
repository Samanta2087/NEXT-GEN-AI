import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Film, Link2, Sparkles, FileVideo, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VIDEO_EXTENSIONS } from "@shared/schema";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUrlSubmit: (url: string) => void;
  isProcessing: boolean;
}

export function UploadZone({ onFilesSelected, onUrlSubmit, isProcessing }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext && VIDEO_EXTENSIONS.includes(ext as any);
    });

    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onFilesSelected]);

  const handleUrlSubmit = useCallback(() => {
    if (url.trim()) {
      onUrlSubmit(url.trim());
      setUrl("");
      setShowUrlInput(false);
    }
  }, [url, onUrlSubmit]);

  return (
    <div className="relative w-full">
      <motion.div
        className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: "linear-gradient(135deg, hsl(195, 100%, 50%), hsl(210, 100%, 55%))" }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 20, 0],
          y: [0, -10, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "linear-gradient(135deg, hsl(280, 85%, 60%), hsl(320, 85%, 55%))" }}
        animate={{
          scale: [1, 1.15, 1],
          x: [0, -15, 0],
          y: [0, 15, 0],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <motion.div
        className={`
          relative overflow-hidden rounded-3xl transition-all duration-500
          ${isDragging 
            ? "glass-strong shadow-2xl scale-[1.02] border-2 border-primary/50" 
            : "glass shadow-float border border-white/40"
          }
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="noise" />
        
        <AnimatePresence>
          {isDragging && (
            <motion.div
              className="absolute inset-0 gradient-primary opacity-10 z-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex flex-col items-center text-center space-y-6">
            <motion.div
              className={`
                relative p-6 rounded-2xl transition-all duration-500
                ${isDragging 
                  ? "gradient-primary shadow-glow-cyan" 
                  : "bg-gradient-to-br from-primary/10 to-accent/10"
                }
              `}
              animate={isDragging ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={isDragging ? {} : { y: [0, -8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                {isDragging ? (
                  <Sparkles className="w-12 h-12 text-white" />
                ) : (
                  <Upload className="w-12 h-12 text-primary" />
                )}
              </motion.div>
              
              <motion.div
                className="absolute -inset-2 rounded-3xl border-2 border-dashed border-primary/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>

            <div className="space-y-2">
              <motion.h2 
                className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text"
                animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
              >
                {isDragging ? "Release to Upload" : "Drop Your Videos Here"}
              </motion.h2>
              <p className="text-muted-foreground text-lg">
                Supports MP4, MKV, AVI, MOV, WEBM
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {VIDEO_EXTENSIONS.map((ext, i) => (
                <motion.div
                  key={ext}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="px-3 py-1.5 rounded-full text-xs font-mono font-medium 
                    bg-gradient-to-r from-primary/10 to-accent/10 
                    border border-primary/20 text-primary"
                >
                  .{ext.toUpperCase()}
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
              <span>or</span>
              <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <input
                ref={fileInputRef}
                type="file"
                accept={VIDEO_EXTENSIONS.map(ext => `.${ext}`).join(',')}
                multiple
                onChange={handleFileInput}
                className="hidden"
                data-testid="input-file-upload"
              />
              
              <Button
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 gap-2 gradient-primary text-white border-0 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                data-testid="button-browse-files"
              >
                <FileVideo className="w-5 h-5" />
                Browse Files
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={isProcessing}
                className="flex-1 gap-2 glass border-primary/20 hover:border-primary/40 transition-all duration-300"
                data-testid="button-url-input-toggle"
              >
                <Link2 className="w-5 h-5" />
                From URL
              </Button>
            </div>

            <AnimatePresence>
              {showUrlInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-lg overflow-hidden"
                >
                  <div className="flex gap-2 p-4 rounded-2xl glass-strong border border-primary/20">
                    <Input
                      type="url"
                      placeholder="Paste video URL here..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                      className="flex-1 bg-white/50 border-primary/20 focus:border-primary/50"
                      data-testid="input-video-url"
                    />
                    <Button
                      onClick={handleUrlSubmit}
                      disabled={!url.trim() || isProcessing}
                      className="gradient-primary text-white px-6"
                      data-testid="button-submit-url"
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowUrlInput(false)}
                      data-testid="button-close-url"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden">
          <motion.div
            className="h-full gradient-primary"
            initial={{ x: "-100%" }}
            animate={{ x: isDragging ? "0%" : "-100%" }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>
    </div>
  );
}
