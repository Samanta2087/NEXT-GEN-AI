import { motion } from "framer-motion";
import { Upload, FileImage, FileText, X } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface FilePreview {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface EnhancedUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in MB
  category?: "image" | "pdf";
  files?: FilePreview[];
  onRemoveFile?: (id: string) => void;
}

export function EnhancedUploadZone({
  onFilesSelected,
  accept = "image/*",
  maxFiles = 50,
  maxSize = 50,
  category = "image",
  files = [],
  onRemoveFile,
}: EnhancedUploadZoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesSelected(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      onFilesSelected(selectedFiles);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getIcon = () => {
    return category === "image" ? FileImage : FileText;
  };

  const Icon = getIcon();

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative"
      >
        <input
          type="file"
          accept={accept}
          multiple
          max={maxFiles}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <Card className="p-12 border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gradient-to-br from-gray-50 to-white hover:from-blue-50 hover:to-cyan-50 transition-all duration-300">
          <div className="flex flex-col items-center text-center space-y-4">
            <motion.div
              className="p-6 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 shadow-inner"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Icon className="w-12 h-12 text-blue-600" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Drop {category === "image" ? "Images" : "PDFs"} Here
              </h3>
              <p className="text-gray-600 mb-4">
                or click to browse your files
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                <Badge variant="secondary" className="font-mono">
                  Max {maxFiles} files
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  Up to {maxSize}MB each
                </Badge>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="mt-4 bg-white hover:bg-gray-50"
              onClick={(e) => e.stopPropagation()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Browse Files
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">
              Uploaded Files ({files.length})
            </h4>
            {files.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => files.forEach(f => onRemoveFile?.(f.id))}
              >
                Clear All
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {files.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-3 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {file.preview ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs font-mono">
                          {formatSize(file.size)}
                        </Badge>
                        <Badge variant="secondary" className="text-xs uppercase">
                          {file.type.split('/')[1] || file.type}
                        </Badge>
                      </div>
                    </div>
                    
                    {onRemoveFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveFile(file.id)}
                        className="flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
