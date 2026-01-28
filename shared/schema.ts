import { z } from "zod";

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm'] as const;
export const AUDIO_BITRATES = [64, 128, 192, 320] as const;

export type VideoBitrate = typeof AUDIO_BITRATES[number];
export type ConversionStatus = 'pending' | 'processing' | 'completed' | 'error';

export const conversionJobSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  originalName: z.string(),
  fileSize: z.number(),
  bitrate: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'error']),
  progress: z.number().min(0).max(100),
  errorMessage: z.string().optional(),
  outputPath: z.string().optional(),
  duration: z.number().optional(),
  trimStart: z.number().optional(),
  trimEnd: z.number().optional(),
  metadata: z.object({
    title: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    coverArt: z.string().optional(),
  }).optional(),
  createdAt: z.number(),
  completedAt: z.number().optional(),
});

export type ConversionJob = z.infer<typeof conversionJobSchema>;

export const createJobSchema = z.object({
  fileName: z.string(),
  originalName: z.string(),
  fileSize: z.number(),
  bitrate: z.number().refine(val => AUDIO_BITRATES.includes(val as VideoBitrate)),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  progress: z.number().min(0).max(100).optional(),
  errorMessage: z.string().optional(),
  outputPath: z.string().optional(),
  duration: z.number().optional(),
  trimStart: z.number().optional(),
  trimEnd: z.number().optional(),
  metadata: z.object({
    title: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    coverArt: z.string().optional(),
  }).optional(),
  completedAt: z.number().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const urlInputSchema = z.object({
  url: z.string().url(),
  bitrate: z.number().refine(val => AUDIO_BITRATES.includes(val as VideoBitrate)),
});

export type UrlInput = z.infer<typeof urlInputSchema>;

export interface QueueState {
  jobs: ConversionJob[];
  isProcessing: boolean;
  currentJobId: string | null;
}

export const users = {} as any;
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
