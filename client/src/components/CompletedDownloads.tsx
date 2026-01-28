import { motion, AnimatePresence } from "framer-motion";
import { Download, CheckCircle2, Trash2, Music2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "./AudioPlayer";
import type { ConversionJob } from "@shared/schema";

interface CompletedDownloadsProps {
  jobs: ConversionJob[];
  onClearAll: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export function CompletedDownloads({ jobs, onClearAll }: CompletedDownloadsProps) {
  if (jobs.length === 0) return null;

  const handleDownload = (job: ConversionJob) => {
    if (job.outputPath) {
      const link = document.createElement("a");
      link.href = `/api/download/${job.id}`;
      link.download = job.originalName.replace(/\.[^/.]+$/, "") + ".mp3";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAll = () => {
    jobs.forEach((job, index) => {
      setTimeout(() => handleDownload(job), index * 500);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl gradient-success">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Ready to Download</h3>
            <p className="text-sm text-muted-foreground">
              {jobs.length} {jobs.length === 1 ? "file" : "files"} converted successfully
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {jobs.length > 1 && (
            <Button
              onClick={handleDownloadAll}
              className="gradient-primary text-white gap-2"
              data-testid="button-download-all"
            >
              <Download className="w-4 h-4" />
              Download All
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClearAll}
            className="gap-2 glass"
            data-testid="button-clear-completed"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {jobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ delay: index * 0.1 }}
            >
              <AudioPlayer
                job={job}
                audioUrl={`/api/download/${job.id}`}
                onDownload={() => handleDownload(job)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
