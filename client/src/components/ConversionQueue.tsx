import { useState, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { 
  GripVertical, Trash2, Settings2, Music, Clock, 
  CheckCircle2, XCircle, Loader2, FileAudio, Play, Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIO_BITRATES, type ConversionJob } from "@shared/schema";

interface ConversionQueueProps {
  jobs: ConversionJob[];
  onReorder: (jobs: ConversionJob[]) => void;
  onRemove: (id: string) => void;
  onBitrateChange: (id: string, bitrate: number) => void;
  onEditMetadata: (job: ConversionJob) => void;
  onTrim: (job: ConversionJob) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function QueueItem({ 
  job, 
  onRemove, 
  onBitrateChange, 
  onEditMetadata, 
  onTrim 
}: { 
  job: ConversionJob;
  onRemove: (id: string) => void;
  onBitrateChange: (id: string, bitrate: number) => void;
  onEditMetadata: (job: ConversionJob) => void;
  onTrim: (job: ConversionJob) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    pending: { 
      icon: Clock, 
      color: "text-muted-foreground", 
      bg: "bg-muted",
      label: "Waiting"
    },
    processing: { 
      icon: Loader2, 
      color: "text-primary", 
      bg: "gradient-primary",
      label: "Converting"
    },
    completed: { 
      icon: CheckCircle2, 
      color: "text-neon-lime", 
      bg: "bg-neon-lime/10",
      label: "Complete"
    },
    error: { 
      icon: XCircle, 
      color: "text-destructive", 
      bg: "bg-destructive/10",
      label: "Failed"
    },
  };

  const status = statusConfig[job.status];
  const StatusIcon = status.icon;

  return (
    <Reorder.Item
      value={job}
      id={job.id}
      className="select-none"
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 20px 50px -15px rgba(0, 0, 0, 0.2)",
        cursor: "grabbing"
      }}
    >
      <motion.div
        layout
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30, height: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          relative overflow-hidden rounded-2xl
          ${job.status === "processing" 
            ? "glass-strong border-2 border-primary/30 shadow-glow-cyan" 
            : "glass border border-white/40"
          }
          ${job.status === "completed" ? "border-neon-lime/30" : ""}
          ${job.status === "error" ? "border-destructive/30" : ""}
        `}
      >
        <div className="noise" />
        
        <div className="relative z-10 p-4">
          <div className="flex items-start gap-4">
            <motion.div 
              className="cursor-grab active:cursor-grabbing p-2 -m-2 rounded-lg hover:bg-black/5 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </motion.div>

            <div className={`
              p-3 rounded-xl
              ${job.status === "processing" ? "gradient-primary animate-pulse-glow" : status.bg}
            `}>
              {job.status === "processing" ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : job.status === "completed" ? (
                <FileAudio className="w-6 h-6 text-neon-lime" />
              ) : (
                <StatusIcon className={`w-6 h-6 ${status.color}`} />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate" title={job.originalName}>
                    {job.originalName}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>{formatFileSize(job.fileSize)}</span>
                    {job.duration && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                        <span>{formatDuration(job.duration)}</span>
                      </>
                    )}
                    <Badge variant="outline" className="text-xs font-mono">
                      {job.bitrate}kbps
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {job.status === "pending" && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hover:bg-primary/10"
                        data-testid={`button-settings-${job.id}`}
                      >
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemove(job.id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                        data-testid={`button-remove-${job.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {job.status === "processing" && (
                <div className="space-y-2">
                  <div className="relative h-2 rounded-full overflow-hidden bg-primary/10">
                    <motion.div
                      className="absolute inset-y-0 left-0 gradient-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                    <div className="absolute inset-0 animate-progress-stripe opacity-50" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary font-medium">{job.progress}%</span>
                    <span className="text-muted-foreground">Converting audio...</span>
                  </div>
                </div>
              )}

              {job.status === "completed" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <Badge className="bg-neon-lime/10 text-neon-lime border-neon-lime/20">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ready to Download
                  </Badge>
                </motion.div>
              )}

              {job.status === "error" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive"
                >
                  {job.errorMessage || "Conversion failed"}
                </motion.div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isExpanded && job.status === "pending" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 pt-4 border-t border-border/50"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Bitrate</label>
                    <Select
                      value={job.bitrate.toString()}
                      onValueChange={(value) => onBitrateChange(job.id, parseInt(value))}
                    >
                      <SelectTrigger className="bg-white/50" data-testid={`select-bitrate-${job.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIO_BITRATES.map((br) => (
                          <SelectItem key={br} value={br.toString()}>
                            {br} kbps {br === 320 && "(Best)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => onTrim(job)}
                    className="h-auto py-3 glass"
                    data-testid={`button-trim-${job.id}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Music className="w-4 h-4" />
                      <span className="text-xs">Trim Audio</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onEditMetadata(job)}
                    className="h-auto py-3 glass"
                    data-testid={`button-metadata-${job.id}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Settings2 className="w-4 h-4" />
                      <span className="text-xs">Edit Metadata</span>
                    </div>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Reorder.Item>
  );
}

export function ConversionQueue({
  jobs,
  onReorder,
  onRemove,
  onBitrateChange,
  onEditMetadata,
  onTrim,
}: ConversionQueueProps) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full gradient-primary animate-pulse" />
          Conversion Queue
          <Badge variant="secondary" className="ml-2">
            {jobs.length} {jobs.length === 1 ? "file" : "files"}
          </Badge>
        </h3>
      </div>

      <Reorder.Group
        axis="y"
        values={jobs}
        onReorder={onReorder}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {jobs.map((job) => (
            <QueueItem
              key={job.id}
              job={job}
              onRemove={onRemove}
              onBitrateChange={onBitrateChange}
              onEditMetadata={onEditMetadata}
              onTrim={onTrim}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
}
