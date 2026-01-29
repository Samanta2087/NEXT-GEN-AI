import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Settings2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { BackgroundOrbs } from "@/components/FloatingOrb";
import { UploadZone } from "@/components/UploadZone";
import { ConversionQueue } from "@/components/ConversionQueue";
import { CompletedDownloads } from "@/components/CompletedDownloads";
import { BitrateSelector } from "@/components/BitrateSelector";
import { MetadataEditor } from "@/components/MetadataEditor";
import { AudioTrimmer } from "@/components/AudioTrimmer";
import { ErrorState, OfflineBanner } from "@/components/ErrorState";
import { useConversionQueue } from "@/hooks/useConversionQueue";
import type { ConversionJob, VideoBitrate } from "@shared/schema";

export default function Home() {
  const {
    jobs,
    isProcessing,
    addFiles,
    addUrl,
    removeJob,
    reorderJobs,
    updateJobBitrate,
    updateJobMetadata,
    updateJobTrim,
    startConversion,
    getCompletedJobs,
    clearCompleted,
    isOnline,
  } = useConversionQueue();

  const [selectedBitrate, setSelectedBitrate] = useState<VideoBitrate>(320);
  const [editingMetadata, setEditingMetadata] = useState<ConversionJob | null>(null);
  const [trimmingJob, setTrimmingJob] = useState<ConversionJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingJobs = jobs.filter(job => job.status === "pending" || job.status === "processing");
  const completedJobs = getCompletedJobs();

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      addFiles(files, selectedBitrate);
    }
  }, [addFiles, selectedBitrate]);

  const handleUrlSubmit = useCallback((url: string) => {
    addUrl(url, selectedBitrate);
  }, [addUrl, selectedBitrate]);

  const handleSaveMetadata = useCallback((metadata: NonNullable<ConversionJob["metadata"]>) => {
    if (editingMetadata) {
      updateJobMetadata(editingMetadata.id, metadata);
    }
  }, [editingMetadata, updateJobMetadata]);

  const handleSaveTrim = useCallback((trimStart: number, trimEnd: number) => {
    if (trimmingJob) {
      updateJobTrim(trimmingJob.id, trimStart, trimEnd);
    }
  }, [trimmingJob, updateJobTrim]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundOrbs />

      <AnimatePresence>
        {!isOnline && <OfflineBanner />}
      </AnimatePresence>

      <div className="relative z-10 container mx-auto px-4 py-6 max-w-5xl">
        <Header showDownloaderLink={false} />

        <main className="space-y-8 pb-20">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <UploadZone
              onFilesSelected={handleFilesSelected}
              onUrlSubmit={handleUrlSubmit}
              isProcessing={isProcessing}
            />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6 border border-white/40"
          >
            <div className="noise" />
            <BitrateSelector value={selectedBitrate} onChange={setSelectedBitrate} />
          </motion.section>

          <AnimatePresence>
            {error && (
              <ErrorState
                message={error}
                onDismiss={() => setError(null)}
                onRetry={() => {
                  setError(null);
                  startConversion();
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {pendingJobs.length > 0 && (
              <motion.section
                key="queue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <ConversionQueue
                  jobs={pendingJobs}
                  onReorder={reorderJobs}
                  onRemove={removeJob}
                  onBitrateChange={updateJobBitrate}
                  onEditMetadata={setEditingMetadata}
                  onTrim={setTrimmingJob}
                />

                {!isProcessing && pendingJobs.some(job => job.status === "pending") && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center"
                  >
                    <Button
                      size="lg"
                      onClick={startConversion}
                      disabled={!isOnline}
                      className="gap-3 px-8 py-6 text-lg gradient-primary text-white shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300"
                      data-testid="button-start-conversion"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                      >
                        <Zap className="w-6 h-6" />
                      </motion.div>
                      Start Conversion
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-sm">
                        {pendingJobs.filter(j => j.status === "pending").length}
                      </span>
                    </Button>
                  </motion.div>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {completedJobs.length > 0 && (
              <motion.section
                key="completed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
              >
                <CompletedDownloads jobs={completedJobs} onClearAll={clearCompleted} />
              </motion.section>
            )}
          </AnimatePresence>

          {jobs.length === 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center py-12"
            >
              <div className="glass rounded-2xl p-8 border border-white/40 max-w-2xl mx-auto">
                <div className="noise" />
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-center gap-2">
                    {["MP4", "MKV", "AVI", "MOV", "WEBM"].map((format, i) => (
                      <motion.div
                        key={format}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="px-3 py-1 rounded-full text-sm font-mono glass border border-primary/20"
                      >
                        {format}
                      </motion.div>
                    ))}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Supported Formats
                  </h3>
                  <p className="text-muted-foreground">
                    Drop any video file above to extract high-quality MP3 audio.
                    Batch conversion supported.
                  </p>
                </div>
              </div>
            </motion.section>
          )}
        </main>
      </div>

      <AnimatePresence>
        {editingMetadata && (
          <MetadataEditor
            job={editingMetadata}
            isOpen={true}
            onClose={() => setEditingMetadata(null)}
            onSave={handleSaveMetadata}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {trimmingJob && (
          <AudioTrimmer
            job={trimmingJob}
            isOpen={true}
            onClose={() => setTrimmingJob(null)}
            onSave={handleSaveTrim}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
