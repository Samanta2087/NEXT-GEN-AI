import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Image, 
  FileText, 
  ArrowLeft,
  Upload,
  Crop,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Download,
  Trash2,
  ChevronRight,
  Layers,
  FileImage,
  Combine,
  Scissors,
  RotateCcw,
  FileOutput,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings2,
  Sparkles,
  Sliders,
  ZoomIn,
  ZoomOut,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { FloatingOrb } from "@/components/FloatingOrb";
import { Header } from "@/components/Header";
import type { ImageJob, PdfJob, ImageOperation, ImageSettings, ImageMetadata } from "@shared/schema";

type ToolCategory = "image" | "pdf" | null;
type ImageTool = "convert" | "resize" | "compress" | "crop" | "rotate" | null;
type PdfTool = "merge" | "split" | "rotate" | "delete" | "reorder" | null;

const IMAGE_TOOLS = [
  { id: "convert" as const, name: "Convert", icon: FileImage, desc: "JPG, PNG, WEBP" },
  { id: "resize" as const, name: "Resize", icon: Maximize2, desc: "Change dimensions" },
  { id: "compress" as const, name: "Compress", icon: Sliders, desc: "Reduce file size" },
  { id: "crop" as const, name: "Crop", icon: Crop, desc: "Cut & frame" },
  { id: "rotate" as const, name: "Rotate/Flip", icon: RotateCw, desc: "Transform image" },
];

const PDF_TOOLS = [
  { id: "merge" as const, name: "Merge", icon: Combine, desc: "Combine PDFs" },
  { id: "split" as const, name: "Split", icon: Scissors, desc: "Separate pages" },
  { id: "rotate" as const, name: "Rotate Pages", icon: RotateCcw, desc: "Turn pages" },
  { id: "delete" as const, name: "Delete Pages", icon: Trash2, desc: "Remove pages" },
  { id: "reorder" as const, name: "Reorder", icon: Layers, desc: "Rearrange pages" },
];

const OUTPUT_FORMATS = [
  { id: "jpg", name: "JPG", desc: "Best for photos" },
  { id: "png", name: "PNG", desc: "Lossless, transparency" },
  { id: "webp", name: "WEBP", desc: "Modern, smallest" },
];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Tools() {
  const [category, setCategory] = useState<ToolCategory>(null);
  const [imageTool, setImageTool] = useState<ImageTool>(null);
  const [pdfTool, setPdfTool] = useState<PdfTool>(null);
  
  const [imageJobs, setImageJobs] = useState<ImageJob[]>([]);
  const [pdfJobs, setPdfJobs] = useState<PdfJob[]>([]);
  
  const [currentImageJob, setCurrentImageJob] = useState<ImageJob | null>(null);
  const [currentImageMetadata, setCurrentImageMetadata] = useState<ImageMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const [outputFormat, setOutputFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [quality, setQuality] = useState(85);
  const [resizeWidth, setResizeWidth] = useState<number | undefined>(undefined);
  const [resizeHeight, setResizeHeight] = useState<number | undefined>(undefined);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "image_progress") {
          setProcessingProgress(data.progress);
        }
      } catch (e) {
        console.error("WebSocket parse error:", e);
      }
    };
    
    wsRef.current = ws;
    
    return () => ws.close();
  }, []);

  const handleBack = useCallback(() => {
    if (imageTool || pdfTool) {
      setImageTool(null);
      setPdfTool(null);
      setCurrentImageJob(null);
      setPreviewUrl(null);
    } else if (category) {
      setCategory(null);
    }
  }, [category, imageTool, pdfTool]);

  const handleImageUpload = useCallback(async (file: File) => {
    const jobId = generateId();
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("jobId", jobId);
    
    try {
      const response = await fetch("/api/image/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const data = await response.json();
      setCurrentImageJob(data.job);
      setCurrentImageMetadata(data.metadata);
      setPreviewUrl(data.previewUrl);
      setImageJobs(prev => [...prev, data.job]);
      
      if (data.metadata.width) {
        setResizeWidth(data.metadata.width);
        setResizeHeight(data.metadata.height);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }, [handleImageUpload]);

  const handleProcess = useCallback(async () => {
    if (!currentImageJob) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    const settings: ImageSettings = {
      outputFormat,
      quality,
    };
    
    let operation: ImageOperation = "convert";
    
    switch (imageTool) {
      case "resize":
        operation = "resize";
        settings.width = resizeWidth;
        settings.height = resizeHeight;
        settings.maintainAspect = maintainAspect;
        break;
      case "compress":
        operation = "compress";
        break;
      case "rotate":
        if (flipH || flipV) {
          operation = "flip";
          settings.flipH = flipH;
          settings.flipV = flipV;
        } else {
          operation = "rotate";
          settings.rotation = rotation;
        }
        break;
      default:
        operation = "convert";
    }
    
    try {
      const response = await fetch("/api/image/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentImageJob.id,
          operation,
          settings,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Processing failed");
      }
      
      const data = await response.json();
      setCurrentImageJob(data.job);
      setImageJobs(prev => prev.map(j => j.id === data.job.id ? data.job : j));
    } catch (error: any) {
      console.error("Processing error:", error);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(100);
    }
  }, [currentImageJob, imageTool, outputFormat, quality, resizeWidth, resizeHeight, maintainAspect, rotation, flipH, flipV]);

  const estimateSize = useCallback(async () => {
    if (!currentImageJob) return;
    
    try {
      const response = await fetch("/api/image/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: currentImageJob.id,
          settings: {
            outputFormat,
            quality,
            width: resizeWidth,
            height: resizeHeight,
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setEstimatedSize(data.estimatedSize);
      }
    } catch (error) {
      console.error("Estimate error:", error);
    }
  }, [currentImageJob, outputFormat, quality, resizeWidth, resizeHeight]);

  useEffect(() => {
    if (currentImageJob) {
      const timer = setTimeout(estimateSize, 300);
      return () => clearTimeout(timer);
    }
  }, [outputFormat, quality, resizeWidth, resizeHeight, estimateSize, currentImageJob]);

  const handleDownload = useCallback(() => {
    if (currentImageJob?.status === "completed") {
      window.location.href = `/api/image/download/${currentImageJob.id}`;
    }
  }, [currentImageJob]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/40 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <FloatingOrb size="lg" color="cyan" delay={0} position={{ top: "10%", left: "5%" }} />
        <FloatingOrb size="md" color="magenta" delay={2} position={{ top: "60%", right: "10%" }} />
        <FloatingOrb size="lg" color="lime" delay={4} position={{ bottom: "10%", left: "20%" }} />
      </div>
      
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      
      <div className="relative z-10">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <AnimatePresence mode="wait">
            {!category && (
              <motion.div
                key="category-select"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="text-center mb-12">
                  <motion.h1 
                    className="text-4xl font-bold bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    Image & PDF Tools
                  </motion.h1>
                  <p className="text-muted-foreground mt-2">Professional-grade processing in your browser</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <motion.button
                    data-testid="button-category-image"
                    onClick={() => setCategory("image")}
                    className="group relative p-8 rounded-3xl glass-strong border border-primary/20 text-left overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="noise" />
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-glow-cyan">
                        <Image className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">Image Tools</h2>
                      <p className="text-muted-foreground">Convert, resize, compress, crop, rotate & more</p>
                      
                      <div className="flex items-center text-cyan-600 mt-4 font-medium">
                        <span>Open workspace</span>
                        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.button>
                  
                  <motion.button
                    data-testid="button-category-pdf"
                    onClick={() => setCategory("pdf")}
                    className="group relative p-8 rounded-3xl glass-strong border border-accent/20 text-left overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="noise" />
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 shadow-glow-magenta">
                        <FileText className="w-8 h-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-2">PDF Tools</h2>
                      <p className="text-muted-foreground">Merge, split, rotate, delete pages & reorder</p>
                      
                      <div className="flex items-center text-purple-600 mt-4 font-medium">
                        <span>Open workspace</span>
                        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {category === "image" && !imageTool && (
              <motion.div
                key="image-tools"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-8">
                  <Button
                    data-testid="button-back"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-3xl font-bold text-foreground">Image Tools</h1>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {IMAGE_TOOLS.map((tool, index) => (
                    <motion.button
                      key={tool.id}
                      data-testid={`button-tool-${tool.id}`}
                      onClick={() => setImageTool(tool.id)}
                      className="group relative p-6 rounded-2xl glass-strong border border-primary/20 text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="noise" />
                      <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-3 group-hover:shadow-glow-cyan transition-shadow">
                        <tool.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-foreground">{tool.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {category === "image" && imageTool && (
              <motion.div
                key="image-workspace"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    data-testid="button-back-workspace"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-2xl font-bold text-foreground capitalize">{imageTool} Image</h1>
                </div>
                
                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-2xl glass-strong border border-primary/20 p-4">
                      <div className="noise" />
                      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-cyan-600" />
                        Input
                      </h3>
                      
                      {!currentImageJob ? (
                        <div
                          className="relative border-2 border-dashed border-primary/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onDrop={handleFileDrop}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                            data-testid="input-file-upload"
                          />
                          
                          {isUploading ? (
                            <Loader2 className="w-10 h-10 text-cyan-600 mx-auto animate-spin" />
                          ) : (
                            <>
                              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                              <p className="text-foreground font-medium">Drop image here</p>
                              <p className="text-sm text-muted-foreground">or click to browse</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
                            {previewUrl && (
                              <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className="max-w-full max-h-full object-contain"
                              />
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Name:</span>
                              <span className="font-medium text-foreground truncate max-w-[150px]">{currentImageJob.originalName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Size:</span>
                              <span className="font-medium text-foreground">{formatFileSize(currentImageJob.fileSize)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Dimensions:</span>
                              <span className="font-medium text-foreground">{currentImageJob.width} × {currentImageJob.height}</span>
                            </div>
                          </div>
                          
                          <Button
                            data-testid="button-clear-image"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentImageJob(null);
                              setPreviewUrl(null);
                            }}
                            className="w-full"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="rounded-2xl glass-strong border border-primary/20 p-4 h-full">
                      <div className="noise" />
                      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-600" />
                        Preview
                      </h3>
                      
                      <div className="rounded-xl bg-[repeating-conic-gradient(#f0f0f0_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] aspect-video flex items-center justify-center overflow-hidden">
                        {previewUrl ? (
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain"
                            style={{
                              transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                            }}
                          />
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Upload an image to preview</p>
                          </div>
                        )}
                      </div>
                      
                      {estimatedSize !== null && (
                        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Estimated output:</span>
                            <span className="font-bold text-foreground">{formatFileSize(estimatedSize)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-3 space-y-4">
                    <div className="rounded-2xl glass-strong border border-primary/20 p-4">
                      <div className="noise" />
                      <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-cyan-600" />
                        Settings
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-2 block">Output Format</label>
                          <div className="grid grid-cols-3 gap-2">
                            {OUTPUT_FORMATS.map((format) => (
                              <Button
                                key={format.id}
                                data-testid={`button-format-${format.id}`}
                                variant={outputFormat === format.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setOutputFormat(format.id as "jpg" | "png" | "webp")}
                                className="flex-col h-auto py-2"
                              >
                                <span className="font-bold uppercase">{format.id}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-foreground">Quality</label>
                            <span className="text-sm font-bold text-cyan-600">{quality}%</span>
                          </div>
                          <Slider
                            data-testid="slider-quality"
                            value={[quality]}
                            onValueChange={([v]) => setQuality(v)}
                            min={10}
                            max={100}
                            step={5}
                            className="w-full"
                          />
                        </div>
                        
                        {imageTool === "resize" && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-foreground mb-1 block">Width (px)</label>
                              <Input
                                data-testid="input-resize-width"
                                type="number"
                                value={resizeWidth || ""}
                                onChange={(e) => setResizeWidth(parseInt(e.target.value) || undefined)}
                                placeholder="Width"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-foreground mb-1 block">Height (px)</label>
                              <Input
                                data-testid="input-resize-height"
                                type="number"
                                value={resizeHeight || ""}
                                onChange={(e) => setResizeHeight(parseInt(e.target.value) || undefined)}
                                placeholder="Height"
                              />
                            </div>
                            <Button
                              data-testid="button-aspect-lock"
                              variant={maintainAspect ? "default" : "outline"}
                              size="sm"
                              onClick={() => setMaintainAspect(!maintainAspect)}
                              className="w-full"
                            >
                              {maintainAspect ? "Aspect Locked" : "Free Resize"}
                            </Button>
                          </div>
                        )}
                        
                        {imageTool === "rotate" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-2">
                              {[0, 90, 180, 270].map((deg) => (
                                <Button
                                  key={deg}
                                  data-testid={`button-rotate-${deg}`}
                                  variant={rotation === deg ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setRotation(deg)}
                                >
                                  {deg}°
                                </Button>
                              ))}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                data-testid="button-flip-h"
                                variant={flipH ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFlipH(!flipH)}
                              >
                                <FlipHorizontal className="w-4 h-4 mr-1" />
                                Flip H
                              </Button>
                              <Button
                                data-testid="button-flip-v"
                                variant={flipV ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFlipV(!flipV)}
                              >
                                <FlipVertical className="w-4 h-4 mr-1" />
                                Flip V
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        data-testid="button-process"
                        onClick={handleProcess}
                        disabled={!currentImageJob || isProcessing}
                        className="w-full gradient-primary text-white"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Processing... {processingProgress}%
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Process Image
                          </>
                        )}
                      </Button>
                      
                      {currentImageJob?.status === "completed" && (
                        <Button
                          data-testid="button-download"
                          onClick={handleDownload}
                          variant="outline"
                          className="w-full"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download Result
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {category === "pdf" && !pdfTool && (
              <motion.div
                key="pdf-tools"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-8">
                  <Button
                    data-testid="button-back"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-3xl font-bold text-foreground">PDF Tools</h1>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {PDF_TOOLS.map((tool, index) => (
                    <motion.button
                      key={tool.id}
                      data-testid={`button-tool-${tool.id}`}
                      onClick={() => setPdfTool(tool.id)}
                      className="group relative p-6 rounded-2xl glass-strong border border-accent/20 text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="noise" />
                      <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-3 group-hover:shadow-glow-magenta transition-shadow">
                        <tool.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-bold text-foreground">{tool.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {category === "pdf" && pdfTool && (
              <motion.div
                key="pdf-workspace"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    data-testid="button-back-pdf"
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <h1 className="text-2xl font-bold text-foreground capitalize">{pdfTool} PDF</h1>
                </div>
                
                <div className="rounded-3xl glass-strong border border-accent/20 p-8 text-center">
                  <div className="noise" />
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-6 shadow-glow-magenta">
                    <FileText className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">PDF {pdfTool} Workspace</h2>
                  <p className="text-muted-foreground mb-6">Upload PDF files to get started with the {pdfTool} tool</p>
                  
                  <Button
                    data-testid="button-upload-pdf"
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                    onClick={() => {}}
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload PDF
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
