import { useState, useCallback, useRef, memo, useMemo, DragEvent } from "react";
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
  Settings2,
  Sparkles,
  Sliders,
  Info,
  Plus,
  Eye,
  Target,
  Wand2,
  ImageMinus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDevice, useAnimationConfig, useThrottledProgress } from "@/hooks/useDevice";
import type { ImageSettings } from "@shared/schema";

interface ToolDefinition {
  id: string;
  category: "image" | "pdf";
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
}

const TOOLS: ToolDefinition[] = [
  // Image Tools
  { id: "convert", category: "image", name: "Convert", description: "Transform between formats", icon: FileImage, color: "text-blue-600", gradient: "from-blue-500/20 to-cyan-500/20" },
  { id: "resize", category: "image", name: "Resize", description: "Scale with precision", icon: Maximize2, color: "text-violet-600", gradient: "from-violet-500/20 to-purple-500/20" },
  { id: "compress", category: "image", name: "Compress", description: "Reduce file size", icon: Sliders, color: "text-emerald-600", gradient: "from-emerald-500/20 to-green-500/20" },
  { id: "crop", category: "image", name: "Crop", description: "Cut & frame images", icon: Crop, color: "text-amber-600", gradient: "from-amber-500/20 to-orange-500/20" },
  { id: "rotate", category: "image", name: "Rotate/Flip", description: "Transform orientation", icon: RotateCw, color: "text-pink-600", gradient: "from-pink-500/20 to-rose-500/20" },
  { id: "remove-bg", category: "image", name: "Remove BG", description: "AI background removal", icon: ImageMinus, color: "text-indigo-600", gradient: "from-indigo-500/20 to-blue-500/20" },
  { id: "to-pdf", category: "image", name: "To PDF", description: "Images to PDF", icon: FileOutput, color: "text-teal-600", gradient: "from-teal-500/20 to-cyan-500/20" },
  { id: "strip-exif", category: "image", name: "Strip EXIF", description: "Remove metadata", icon: Eye, color: "text-red-600", gradient: "from-red-500/20 to-pink-500/20" },

  // PDF Tools
  { id: "pdf-merge", category: "pdf", name: "Merge PDFs", description: "Combine multiple PDFs", icon: Combine, color: "text-blue-600", gradient: "from-blue-500/20 to-indigo-500/20" },
  { id: "pdf-split", category: "pdf", name: "Split PDF", description: "Extract pages", icon: Scissors, color: "text-purple-600", gradient: "from-purple-500/20 to-pink-500/20" },
  { id: "pdf-compress", category: "pdf", name: "Compress", description: "Reduce PDF size", icon: Sliders, color: "text-green-600", gradient: "from-green-500/20 to-emerald-500/20" },
  { id: "pdf-rotate", category: "pdf", name: "Rotate Pages", description: "Turn pages", icon: RotateCcw, color: "text-orange-600", gradient: "from-orange-500/20 to-amber-500/20" },
  { id: "pdf-to-image", category: "pdf", name: "To Images", description: "Export as images", icon: FileImage, color: "text-cyan-600", gradient: "from-cyan-500/20 to-teal-500/20" },
  { id: "delete-pages", category: "pdf", name: "Delete Pages", description: "Remove pages", icon: Trash2, color: "text-red-600", gradient: "from-red-500/20 to-rose-500/20" },
  { id: "reorder", category: "pdf", name: "Reorder", description: "Rearrange pages", icon: Layers, color: "text-violet-600", gradient: "from-violet-500/20 to-purple-500/20" },
];

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  selected: boolean;
}

// Memoized Tool Card - Uses CSS transforms instead of JS animations where possible
const ToolCard = memo(function ToolCard({
  tool,
  index,
  onSelect,
  isMobile,
  enableAnimations
}: {
  tool: ToolDefinition;
  index: number;
  onSelect: (tool: ToolDefinition) => void;
  isMobile: boolean;
  enableAnimations: boolean;
}) {
  const Icon = tool.icon;

  // Use CSS classes for animations on mobile for better performance
  const animClass = enableAnimations
    ? 'transform transition-transform duration-150 active:scale-[0.98]'
    : '';

  return (
    <button
      onClick={() => onSelect(tool)}
      className={`group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl ${animClass}`}
      style={enableAnimations ? { animationDelay: `${index * 30}ms` } : undefined}
    >
      <Card className={`relative overflow-hidden ${isMobile ? 'p-4' : 'p-5'} h-full bg-white/90 border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow duration-150`}>
        <div className="flex items-center gap-3">
          <div className={`${isMobile ? 'p-2.5' : 'p-3'} rounded-xl bg-gradient-to-br ${tool.gradient} border border-white/40 flex-shrink-0`}>
            <Icon className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} ${tool.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>{tool.name}</h3>
            <p className="text-xs text-gray-500 truncate">{tool.description}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>
      </Card>
    </button>
  );
});

// Memoized File Item - Touch-optimized
const FileItem = memo(function FileItem({
  file,
  onToggle,
  isMobile
}: {
  file: UploadedFile;
  onToggle: (id: string) => void;
  isMobile: boolean;
}) {
  return (
    <button
      onClick={() => onToggle(file.id)}
      className={`relative w-full ${isMobile ? 'p-3 min-h-[56px]' : 'p-3'} rounded-xl border-2 text-left transition-colors duration-100 ${file.selected
        ? 'border-blue-500 bg-blue-50/50'
        : 'border-gray-200 bg-white active:bg-gray-50'
        }`}
    >
      <div className="flex items-center gap-3">
        {file.preview && (
          <div className={`${isMobile ? 'w-11 h-11' : 'w-12 h-12'} rounded-lg overflow-hidden bg-gray-100 flex-shrink-0`}>
            <img
              src={file.preview}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">
            {file.file.name}
          </p>
          <p className="text-xs text-gray-500">
            {(file.file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        {file.selected && (
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
});

export default function Tools() {
  const device = useDevice();
  const animConfig = useAnimationConfig();
  const { isMobile, isTablet } = device;

  const [view, setView] = useState<"selection" | "workspace">("selection");
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Settings
  const [outputFormat, setOutputFormat] = useState<"jpg" | "png" | "webp">("jpg");
  const [quality, setQuality] = useState(85);
  const [targetSize, setTargetSize] = useState<number | null>(null);
  const [resizeWidth, setResizeWidth] = useState<number | undefined>(undefined);
  const [resizeHeight, setResizeHeight] = useState<number | undefined>(undefined);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [pdfPagesToDelete, setPdfPagesToDelete] = useState<string>("");
  const [pdfRotateDegrees, setPdfRotateDegrees] = useState<number>(90);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Mobile-specific state
  const [showMobileControls, setShowMobileControls] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Throttle progress on mobile for performance
  const displayProgress = useThrottledProgress(processingProgress, isMobile ? 200 : 50);

  const handleToolSelect = useCallback((tool: ToolDefinition) => {
    setSelectedTool(tool);
    setView("workspace");
    setUploadedFiles([]);
    setShowMobileControls(false);
  }, []);

  const handleBack = useCallback(() => {
    setView("selection");
    setSelectedTool(null);
    setUploadedFiles([]);
    setShowMobileControls(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFilesInternal(files);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFilesInternal(files);
    }
  }, []);

  const handleFilesInternal = async (files: File[]) => {
    setIsUploading(true);

    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      selected: true,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setIsUploading(false);
  };

  const toggleFileSelection = useCallback((id: string) => {
    setUploadedFiles(prev => prev.map(f =>
      f.id === id ? { ...f, selected: !f.selected } : f
    ));
  }, []);

  // Process selected files
  const handleProcess = async () => {
    const filesToProcess = uploadedFiles.filter(f => f.selected);

    if (filesToProcess.length === 0 || !selectedTool) {
      alert('Please select at least one file');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      if (selectedTool.category === "image") {
        for (let i = 0; i < filesToProcess.length; i++) {
          const fileData = filesToProcess[i];
          setProcessingProgress(Math.round((i / filesToProcess.length) * 50));

          const formData = new FormData();
          const jobId = `job_${Date.now()}_${i}`;
          formData.append("file", fileData.file);
          formData.append("jobId", jobId);

          const uploadResponse = await fetch("/api/image/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) throw new Error(`Failed to upload ${fileData.file.name}`);

          const effectiveFormat = selectedTool.id === "remove-bg" ? "png" : outputFormat;

          const settings: ImageSettings = {
            outputFormat: effectiveFormat,
            quality,
            width: resizeWidth,
            height: resizeHeight,
            maintainAspect,
            rotation,
            flipH,
            flipV,
          };

          const processResponse = await fetch("/api/image/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId,
              operation: selectedTool.id,
              settings,
            }),
          });

          if (!processResponse.ok) throw new Error(`Failed to process ${fileData.file.name}`);

          const processData = await processResponse.json();
          setProcessingProgress(Math.round(((i + 1) / filesToProcess.length) * 100));

          if (processData.job?.status === "completed") {
            let downloadFormat = selectedTool.id === "remove-bg" ? "png"
              : selectedTool.id === "to-pdf" ? "pdf" : outputFormat;
            const link = document.createElement('a');
            link.href = `/api/image/download/${jobId}`;
            link.download = fileData.file.name.replace(/\.[^.]+$/, `.${downloadFormat}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      } else if (selectedTool.category === "pdf") {
        const pdfFiles = filesToProcess;

        if (selectedTool.id === "pdf-merge") {
          const jobIds: string[] = [];

          for (let i = 0; i < pdfFiles.length; i++) {
            const fileData = pdfFiles[i];
            const jobId = `pdf_${Date.now()}_${i}`;

            const formData = new FormData();
            formData.append("file", fileData.file);
            formData.append("jobId", jobId);

            const uploadResponse = await fetch("/api/pdf/upload", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) throw new Error(`Failed to upload ${fileData.file.name}`);

            jobIds.push(jobId);
            setProcessingProgress(Math.round((i / pdfFiles.length) * 50));
          }

          const mergeResponse = await fetch("/api/pdf/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobIds }),
          });

          if (!mergeResponse.ok) throw new Error("Failed to merge PDFs");

          const mergeData = await mergeResponse.json();
          setProcessingProgress(100);

          if (mergeData.job?.status === "completed") {
            const link = document.createElement('a');
            link.href = `/api/pdf/download/${mergeData.job.id}`;
            link.download = 'merged.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        } else {
          const fileData = pdfFiles[0];
          const jobId = `pdf_${Date.now()}`;

          const formData = new FormData();
          formData.append("file", fileData.file);
          formData.append("jobId", jobId);

          const uploadResponse = await fetch("/api/pdf/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) throw new Error(`Failed to upload ${fileData.file.name}`);

          setProcessingProgress(50);

          let endpoint = "/api/pdf/";
          const body: Record<string, unknown> = { jobId };

          switch (selectedTool.id) {
            case "pdf-split":
              endpoint += "split";
              body.ranges = "all";
              break;
            case "pdf-compress":
              endpoint += "compress";
              body.level = "medium";
              break;
            case "pdf-rotate":
              endpoint += "rotate";
              body.pages = "all";
              body.degrees = pdfRotateDegrees;
              break;
            case "pdf-to-image":
              endpoint += "to-images";
              body.format = "png";
              break;
            case "delete-pages":
              endpoint += "delete-pages";
              if (pdfPagesToDelete.trim()) {
                const pages: number[] = [];
                pdfPagesToDelete.split(",").forEach(part => {
                  const trimmed = part.trim();
                  if (trimmed.includes("-")) {
                    const [start, end] = trimmed.split("-").map(n => parseInt(n.trim()));
                    for (let i = start; i <= end; i++) pages.push(i);
                  } else {
                    pages.push(parseInt(trimmed));
                  }
                });
                body.pages = pages.filter(n => !isNaN(n));
              } else {
                throw new Error("Please enter page numbers to delete");
              }
              break;
            case "reorder":
              endpoint += "reorder";
              break;
            default:
              throw new Error(`Unsupported PDF operation: ${selectedTool.id}`);
          }

          const processResponse = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!processResponse.ok) {
            const errData = await processResponse.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to process PDF");
          }

          const processData = await processResponse.json();
          setProcessingProgress(100);

          if (processData.job?.status === "completed") {
            const link = document.createElement('a');
            link.href = `/api/pdf/download/${processData.job.id}`;
            link.download = 'processed.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }
      }

      alert("✅ Processing complete!");
      setUploadedFiles(prev => prev.map(f => ({ ...f, selected: false })));
    } catch (error: any) {
      console.error("Processing error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const selectedCount = useMemo(() => uploadedFiles.filter(f => f.selected).length, [uploadedFiles]);
  const imageTools = useMemo(() => TOOLS.filter(t => t.category === "image"), []);
  const pdfTools = useMemo(() => TOOLS.filter(t => t.category === "pdf"), []);

  // Decide whether to use Framer Motion based on device
  const useMotion = animConfig.enableAnimations && !isMobile;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">

      {view === "selection" ? (
        <div className={`container mx-auto ${isMobile ? 'px-4 py-6' : 'px-6 py-10'}`}>
          <div className="max-w-5xl mx-auto">
            {/* Hero - Compact on mobile */}
            <div className={`text-center ${isMobile ? 'mb-6' : 'mb-10'}`}>
              <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-bold mb-1 text-gray-900`}>
                Creative Studio
              </h1>
              <p className={`${isMobile ? 'text-sm' : 'text-base'} text-gray-600`}>
                Professional image & PDF tools
              </p>
            </div>

            {/* Image Tools */}
            <section className={isMobile ? 'mb-6' : 'mb-10'}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20`}>
                  <Image className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600`} />
                </div>
                <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>Image Tools</h2>
                <Badge variant="secondary" className="ml-auto text-xs px-2">8</Badge>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : isTablet ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-3'}`}>
                {imageTools.map((tool, index) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    index={index}
                    onSelect={handleToolSelect}
                    isMobile={isMobile}
                    enableAnimations={animConfig.enableAnimations}
                  />
                ))}
              </div>
            </section>

            {/* PDF Tools */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20`}>
                  <FileText className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-600`} />
                </div>
                <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900`}>PDF Tools</h2>
                <Badge variant="secondary" className="ml-auto text-xs px-2">7</Badge>
              </div>

              <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : isTablet ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-3'}`}>
                {pdfTools.map((tool, index) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    index={index}
                    onSelect={handleToolSelect}
                    isMobile={isMobile}
                    enableAnimations={animConfig.enableAnimations}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          {/* Sticky Header - Compact & efficient */}
          <div className={`sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 ${isMobile ? 'px-3 py-2' : 'px-6 py-3'}`}>
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="rounded-lg h-9 w-9"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>

                {selectedTool && (
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-gradient-to-br ${selectedTool.gradient}`}>
                      <selectedTool.icon className={`w-4 h-4 ${selectedTool.color}`} />
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">{selectedTool.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                    {selectedCount}
                  </Badge>
                )}

                {/* Mobile: Settings toggle */}
                {isMobile && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowMobileControls(!showMobileControls)}
                    className="h-9 w-9"
                  >
                    {showMobileControls ? <X className="w-4 h-4" /> : <Settings2 className="w-4 h-4" />}
                  </Button>
                )}

                <Button
                  disabled={selectedCount === 0 || isProcessing}
                  onClick={handleProcess}
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white h-9 px-4"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      {displayProgress}%
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Process
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Controls Drawer */}
          {isMobile && showMobileControls && (
            <div className="bg-white border-b border-gray-200 p-4 max-h-64 overflow-y-auto">
              <MobileControls
                tool={selectedTool!}
                outputFormat={outputFormat}
                setOutputFormat={setOutputFormat}
                quality={quality}
                setQuality={setQuality}
                rotation={rotation}
                setRotation={setRotation}
                flipH={flipH}
                setFlipH={setFlipH}
                flipV={flipV}
                setFlipV={setFlipV}
                pdfPagesToDelete={pdfPagesToDelete}
                setPdfPagesToDelete={setPdfPagesToDelete}
                pdfRotateDegrees={pdfRotateDegrees}
                setPdfRotateDegrees={setPdfRotateDegrees}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className={`flex-1 ${isMobile ? 'p-3' : 'p-6'}`}>
            <div className={`max-w-7xl mx-auto h-full ${!isMobile ? 'grid grid-cols-12 gap-5' : ''}`}>

              {/* File Upload Area */}
              <div className={isMobile ? 'mb-4' : 'col-span-5'}>
                <Card className="bg-white/90 border border-gray-200">
                  <div className={`${isMobile ? 'p-3' : 'p-4'} border-b border-gray-100`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                        <Upload className="w-4 h-4 text-blue-600" />
                        Files
                      </h3>
                      <span className="text-xs text-gray-500">{uploadedFiles.length} loaded</span>
                    </div>
                  </div>

                  <div className={`${isMobile ? 'p-3' : 'p-4'} ${isMobile ? 'max-h-48' : 'max-h-[55vh]'} overflow-y-auto`}>
                    {uploadedFiles.length === 0 ? (
                      <button
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full ${isMobile ? 'py-10' : 'py-16'} rounded-xl border-2 border-dashed transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 active:bg-gray-50'
                          }`}
                      >
                        <div className="flex flex-col items-center">
                          <Upload className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} text-gray-400 mb-3`} />
                          <p className="font-medium text-gray-700 text-sm">
                            {isDragging ? 'Drop files here' : 'Tap to select files'}
                          </p>
                          {!isMobile && <p className="text-xs text-gray-500 mt-1">or drag & drop</p>}
                        </div>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {uploadedFiles.map((file) => (
                          <FileItem
                            key={file.id}
                            file={file}
                            onToggle={toggleFileSelection}
                            isMobile={isMobile}
                          />
                        ))}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add More
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Desktop Controls Panel */}
              {!isMobile && (
                <div className="col-span-7">
                  <Card className="bg-white/90 border border-gray-200 h-full">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                        <Settings2 className="w-4 h-4 text-orange-600" />
                        Settings
                      </h3>
                    </div>

                    <div className="p-4 overflow-y-auto max-h-[55vh]">
                      <DesktopControls
                        tool={selectedTool!}
                        outputFormat={outputFormat}
                        setOutputFormat={setOutputFormat}
                        quality={quality}
                        setQuality={setQuality}
                        resizeWidth={resizeWidth}
                        setResizeWidth={setResizeWidth}
                        resizeHeight={resizeHeight}
                        setResizeHeight={setResizeHeight}
                        maintainAspect={maintainAspect}
                        setMaintainAspect={setMaintainAspect}
                        rotation={rotation}
                        setRotation={setRotation}
                        flipH={flipH}
                        setFlipH={setFlipH}
                        flipV={flipV}
                        setFlipV={setFlipV}
                        autoOptimize={autoOptimize}
                        setAutoOptimize={setAutoOptimize}
                        targetSize={targetSize}
                        setTargetSize={setTargetSize}
                        pdfPagesToDelete={pdfPagesToDelete}
                        setPdfPagesToDelete={setPdfPagesToDelete}
                        pdfRotateDegrees={pdfRotateDegrees}
                        setPdfRotateDegrees={setPdfRotateDegrees}
                      />
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={selectedTool?.category === "image" ? "image/*" : "application/pdf"}
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}
    </div>
  );
}

// Mobile Controls - Compact, essential options only
function MobileControls({
  tool,
  outputFormat,
  setOutputFormat,
  quality,
  setQuality,
  rotation,
  setRotation,
  flipH,
  setFlipH,
  flipV,
  setFlipV,
  pdfPagesToDelete,
  setPdfPagesToDelete,
  pdfRotateDegrees,
  setPdfRotateDegrees,
}: {
  tool: ToolDefinition;
  outputFormat: string;
  setOutputFormat: (f: any) => void;
  quality: number;
  setQuality: (q: number) => void;
  rotation: number;
  setRotation: (r: number) => void;
  flipH: boolean;
  setFlipH: (f: boolean) => void;
  flipV: boolean;
  setFlipV: (f: boolean) => void;
  pdfPagesToDelete: string;
  setPdfPagesToDelete: (p: string) => void;
  pdfRotateDegrees: number;
  setPdfRotateDegrees: (d: number) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Format Selection */}
      {(tool.id === "convert" || tool.id === "compress" || tool.id === "resize") && (
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-2 block">Format</Label>
          <div className="flex gap-2">
            {(["jpg", "png", "webp"] as const).map((fmt) => (
              <Button
                key={fmt}
                variant={outputFormat === fmt ? "default" : "outline"}
                size="sm"
                onClick={() => setOutputFormat(fmt)}
                className="flex-1 uppercase text-xs font-bold h-10"
              >
                {fmt}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Quality Slider */}
      {(tool.id === "compress" || tool.id === "convert") && (
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-xs font-medium text-gray-600">Quality</Label>
            <span className="text-xs font-bold text-blue-600">{quality}%</span>
          </div>
          <Slider
            value={[quality]}
            onValueChange={(v: number[]) => setQuality(v[0])}
            min={10}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Rotate Controls */}
      {tool.id === "rotate" && (
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant={rotation === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setRotation(rotation === 90 ? 0 : 90)}
            className="text-xs h-10"
          >
            90° →
          </Button>
          <Button
            variant={rotation === -90 ? "default" : "outline"}
            size="sm"
            onClick={() => setRotation(rotation === -90 ? 0 : -90)}
            className="text-xs h-10"
          >
            ← 90°
          </Button>
          <Button
            variant={flipH ? "default" : "outline"}
            size="sm"
            onClick={() => setFlipH(!flipH)}
            className="h-10"
          >
            <FlipHorizontal className="w-4 h-4" />
          </Button>
          <Button
            variant={flipV ? "default" : "outline"}
            size="sm"
            onClick={() => setFlipV(!flipV)}
            className="h-10"
          >
            <FlipVertical className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* PDF Delete Pages */}
      {tool.id === "delete-pages" && (
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-2 block">Pages to Delete</Label>
          <Input
            value={pdfPagesToDelete}
            onChange={(e) => setPdfPagesToDelete(e.target.value)}
            placeholder="e.g., 1, 3, 5-7"
            className="text-sm h-10"
          />
        </div>
      )}

      {/* PDF Rotate */}
      {tool.id === "pdf-rotate" && (
        <div className="grid grid-cols-3 gap-2">
          {[90, -90, 180].map((deg) => (
            <Button
              key={deg}
              variant={pdfRotateDegrees === deg ? "default" : "outline"}
              size="sm"
              onClick={() => setPdfRotateDegrees(deg)}
              className="text-xs h-10"
            >
              {deg > 0 ? `+${deg}°` : `${deg}°`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// Desktop Controls - Full feature set
function DesktopControls({
  tool,
  outputFormat,
  setOutputFormat,
  quality,
  setQuality,
  resizeWidth,
  setResizeWidth,
  resizeHeight,
  setResizeHeight,
  maintainAspect,
  setMaintainAspect,
  rotation,
  setRotation,
  flipH,
  setFlipH,
  flipV,
  setFlipV,
  autoOptimize,
  setAutoOptimize,
  targetSize,
  setTargetSize,
  pdfPagesToDelete,
  setPdfPagesToDelete,
  pdfRotateDegrees,
  setPdfRotateDegrees,
}: {
  tool: ToolDefinition;
  outputFormat: string;
  setOutputFormat: (f: any) => void;
  quality: number;
  setQuality: (q: number) => void;
  resizeWidth?: number;
  setResizeWidth: (w?: number) => void;
  resizeHeight?: number;
  setResizeHeight: (h?: number) => void;
  maintainAspect: boolean;
  setMaintainAspect: (m: boolean) => void;
  rotation: number;
  setRotation: (r: number) => void;
  flipH: boolean;
  setFlipH: (f: boolean) => void;
  flipV: boolean;
  setFlipV: (f: boolean) => void;
  autoOptimize: boolean;
  setAutoOptimize: (o: boolean) => void;
  targetSize: number | null;
  setTargetSize: (s: number | null) => void;
  pdfPagesToDelete: string;
  setPdfPagesToDelete: (p: string) => void;
  pdfRotateDegrees: number;
  setPdfRotateDegrees: (d: number) => void;
}) {
  const resolutionPresets = [
    { name: "Icon", size: 32 },
    { name: "Thumb", size: 150 },
    { name: "Small", size: 480 },
    { name: "Medium", size: 1024 },
    { name: "Large", size: 1920 },
    { name: "4K", size: 3840 },
  ];

  return (
    <div className="space-y-5">
      {/* Output Format */}
      {(tool.id === "convert" || tool.id === "compress" || tool.id === "resize") && (
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">Output Format</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["jpg", "png", "webp"] as const).map((format) => (
              <Button
                key={format}
                variant={outputFormat === format ? "default" : "outline"}
                size="sm"
                onClick={() => setOutputFormat(format)}
                className={`uppercase font-bold ${outputFormat === format ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : ""}`}
              >
                {format}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Quality Slider */}
      {(tool.id === "compress" || tool.id === "convert") && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-semibold text-gray-700">Quality</Label>
            <Badge variant="secondary" className={`font-mono text-xs ${quality < 50 ? 'bg-red-100 text-red-700' :
              quality < 75 ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
              {quality}%
            </Badge>
          </div>
          <Slider
            value={[quality]}
            onValueChange={(values: number[]) => setQuality(values[0])}
            min={10}
            max={100}
            step={5}
          />
        </div>
      )}

      {/* Resize Dimensions */}
      {tool.id === "resize" && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">Quick Presets</Label>
            <div className="grid grid-cols-3 gap-2">
              {resolutionPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResizeWidth(preset.size);
                    setResizeHeight(undefined);
                  }}
                  className="flex flex-col h-auto py-2"
                >
                  <span className="text-xs font-bold">{preset.name}</span>
                  <span className="text-[10px] text-gray-500">{preset.size}px</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Width (px)</Label>
              <Input
                type="number"
                value={resizeWidth || ""}
                onChange={(e) => setResizeWidth(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Auto"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Height (px)</Label>
              <Input
                type="number"
                value={resizeHeight || ""}
                onChange={(e) => setResizeHeight(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Auto"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <Label className="text-sm font-medium text-gray-700">Lock Aspect Ratio</Label>
            <Switch checked={maintainAspect} onCheckedChange={setMaintainAspect} />
          </div>
        </div>
      )}

      {/* Rotate Settings */}
      {tool.id === "rotate" && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700 block">
            Rotation {rotation !== 0 && <span className="text-blue-600">({rotation}°)</span>}
          </Label>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant={rotation === 90 ? "default" : "outline"}
              onClick={() => setRotation(rotation === 90 ? 0 : 90)}
              className="h-12 flex flex-col gap-1"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[10px]">90°</span>
            </Button>
            <Button
              variant={rotation === -90 ? "default" : "outline"}
              onClick={() => setRotation(rotation === -90 ? 0 : -90)}
              className="h-12 flex flex-col gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px]">-90°</span>
            </Button>
            <Button
              variant={flipH ? "default" : "outline"}
              onClick={() => setFlipH(!flipH)}
              className="h-12 flex flex-col gap-1"
            >
              <FlipHorizontal className="w-4 h-4" />
              <span className="text-[10px]">Flip H</span>
            </Button>
            <Button
              variant={flipV ? "default" : "outline"}
              onClick={() => setFlipV(!flipV)}
              className="h-12 flex flex-col gap-1"
            >
              <FlipVertical className="w-4 h-4" />
              <span className="text-[10px]">Flip V</span>
            </Button>
          </div>
        </div>
      )}

      {/* PDF Delete Pages */}
      {tool.id === "delete-pages" && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            <Label className="text-sm font-semibold text-gray-700">Pages to Delete</Label>
          </div>
          <Input
            value={pdfPagesToDelete}
            onChange={(e) => setPdfPagesToDelete(e.target.value)}
            placeholder="e.g., 1, 3, 5-7"
          />
          <p className="text-xs text-gray-500 mt-2">
            Enter page numbers separated by commas, or use ranges
          </p>
        </div>
      )}

      {/* PDF Rotate */}
      {tool.id === "pdf-rotate" && (
        <div>
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">Rotation Angle</Label>
          <div className="grid grid-cols-3 gap-2">
            {[{ deg: 90, label: "90° CW" }, { deg: -90, label: "90° CCW" }, { deg: 180, label: "180°" }].map(({ deg, label }) => (
              <Button
                key={deg}
                variant={pdfRotateDegrees === deg ? "default" : "outline"}
                onClick={() => setPdfRotateDegrees(deg)}
                className="h-12 flex flex-col gap-1"
              >
                {deg === 90 && <RotateCw className="w-4 h-4" />}
                {deg === -90 && <RotateCcw className="w-4 h-4" />}
                {deg === 180 && <span className="text-lg">↻</span>}
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Auto Optimize */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white shadow-sm">
            <Wand2 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">Auto Optimize</p>
            <p className="text-xs text-gray-500">AI-powered</p>
          </div>
        </div>
        <Switch checked={autoOptimize} onCheckedChange={setAutoOptimize} />
      </div>

      {/* Info */}
      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-500">
            <p className="font-medium mb-1">Tips</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Original files preserved</li>
              <li>Batch up to 50 files</li>
              <li>Max 50MB per file</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
