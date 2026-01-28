import { useState, useCallback, useRef, useEffect } from "react";
import type { ConversionJob, VideoBitrate } from "@shared/schema";

interface UseConversionQueueReturn {
  jobs: ConversionJob[];
  isProcessing: boolean;
  currentJobId: string | null;
  addFiles: (files: File[], bitrate: VideoBitrate) => void;
  addUrl: (url: string, bitrate: VideoBitrate) => void;
  removeJob: (id: string) => void;
  reorderJobs: (jobs: ConversionJob[]) => void;
  updateJobBitrate: (id: string, bitrate: number) => void;
  updateJobMetadata: (id: string, metadata: NonNullable<ConversionJob["metadata"]>) => void;
  updateJobTrim: (id: string, trimStart: number, trimEnd: number) => void;
  startConversion: () => Promise<void>;
  getCompletedJobs: () => ConversionJob[];
  clearCompleted: () => void;
  isOnline: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function useConversionQueue(): UseConversionQueueReturn {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "progress") {
            setJobs(prev => prev.map(job => 
              job.id === data.jobId 
                ? { ...job, progress: data.progress }
                : job
            ));
          } else if (data.type === "completed") {
            setJobs(prev => prev.map(job => 
              job.id === data.jobId 
                ? { 
                    ...job, 
                    status: "completed" as const, 
                    progress: 100, 
                    outputPath: data.outputPath,
                    duration: data.duration,
                    completedAt: Date.now()
                  }
                : job
            ));
          } else if (data.type === "error") {
            setJobs(prev => prev.map(job => 
              job.id === data.jobId 
                ? { ...job, status: "error" as const, errorMessage: data.message }
                : job
            ));
          }
        } catch (e) {
          console.error("WebSocket message parse error:", e);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setTimeout(() => {
          if (isOnline) connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }
  }, [isOnline]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const addFiles = useCallback((files: File[], bitrate: VideoBitrate) => {
    const newJobs: ConversionJob[] = files.map(file => {
      const jobId = generateId();
      pendingFilesRef.current.set(jobId, file);
      
      return {
        id: jobId,
        fileName: file.name,
        originalName: file.name,
        fileSize: file.size,
        bitrate,
        status: "pending" as const,
        progress: 0,
        createdAt: Date.now(),
      };
    });

    setJobs(prev => [...prev, ...newJobs]);
  }, []);

  const addUrl = useCallback((url: string, bitrate: VideoBitrate) => {
    const jobId = generateId();
    const fileName = url.split("/").pop()?.split("?")[0] || "video";

    const newJob: ConversionJob = {
      id: jobId,
      fileName: url,
      originalName: fileName,
      fileSize: 0,
      bitrate,
      status: "pending" as const,
      progress: 0,
      createdAt: Date.now(),
    };

    setJobs(prev => [...prev, newJob]);
  }, []);

  const removeJob = useCallback((id: string) => {
    pendingFilesRef.current.delete(id);
    setJobs(prev => prev.filter(job => job.id !== id));
  }, []);

  const reorderJobs = useCallback((newJobs: ConversionJob[]) => {
    setJobs(newJobs);
  }, []);

  const updateJobBitrate = useCallback((id: string, bitrate: number) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, bitrate } : job
    ));
  }, []);

  const updateJobMetadata = useCallback((id: string, metadata: NonNullable<ConversionJob["metadata"]>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, metadata } : job
    ));
  }, []);

  const updateJobTrim = useCallback((id: string, trimStart: number, trimEnd: number) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, trimStart, trimEnd } : job
    ));
  }, []);

  const uploadFile = useCallback(async (jobId: string, file: File, bitrate: number): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("jobId", jobId);
    formData.append("bitrate", bitrate.toString());

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return true;
    } catch (error) {
      console.error("Upload error:", error);
      return false;
    }
  }, []);

  const startConversion = useCallback(async () => {
    const pendingJobs = jobs.filter(job => job.status === "pending");
    if (pendingJobs.length === 0) return;

    setIsProcessing(true);

    for (const job of pendingJobs) {
      setCurrentJobId(job.id);
      
      const file = pendingFilesRef.current.get(job.id);
      
      if (file) {
        const uploaded = await uploadFile(job.id, file, job.bitrate);
        if (!uploaded) {
          setJobs(prev => prev.map(j => 
            j.id === job.id 
              ? { ...j, status: "error" as const, errorMessage: "Upload failed" }
              : j
          ));
          continue;
        }
        pendingFilesRef.current.delete(job.id);
      }

      setJobs(prev => prev.map(j => 
        j.id === job.id ? { ...j, status: "processing" as const } : j
      ));

      try {
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: job.id,
            bitrate: job.bitrate,
            trimStart: job.trimStart,
            trimEnd: job.trimEnd,
            metadata: job.metadata,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Conversion failed");
        }

        const result = await response.json();
        
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { 
                ...j, 
                status: "completed" as const, 
                progress: 100,
                outputPath: result.outputPath,
                duration: result.duration,
                completedAt: Date.now()
              }
            : j
        ));
      } catch (error: any) {
        setJobs(prev => prev.map(j => 
          j.id === job.id 
            ? { ...j, status: "error" as const, errorMessage: error.message }
            : j
        ));
      }
    }

    setIsProcessing(false);
    setCurrentJobId(null);
  }, [jobs, uploadFile]);

  const getCompletedJobs = useCallback(() => {
    return jobs.filter(job => job.status === "completed");
  }, [jobs]);

  const clearCompleted = useCallback(() => {
    setJobs(prev => prev.filter(job => job.status !== "completed"));
  }, []);

  return {
    jobs,
    isProcessing,
    currentJobId,
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
  };
}
