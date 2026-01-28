import { z } from "zod";

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'avi', 'mov', 'webm'] as const;
export const AUDIO_BITRATES = [64, 128, 192, 320] as const;
export const VIDEO_RESOLUTIONS = ['144', '240', '360', '480', '720', '1080', '1440', '2160'] as const;
export const SUPPORTED_PLATFORMS = ['youtube', 'instagram', 'facebook', 'unknown'] as const;
export const AUDIO_FORMATS = ['mp3', 'm4a', 'opus'] as const;

export type VideoBitrate = typeof AUDIO_BITRATES[number];
export type VideoResolution = typeof VIDEO_RESOLUTIONS[number];
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];
export type AudioFormat = typeof AUDIO_FORMATS[number];
export type ConversionStatus = 'pending' | 'processing' | 'completed' | 'error';
export type DownloadStatus = 'analyzing' | 'pending' | 'downloading' | 'converting' | 'completed' | 'error';

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

export interface MediaFormat {
  formatId: string;
  ext: string;
  resolution?: string;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesizeApprox?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  quality?: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface MediaInfo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  uploadDate?: string;
  viewCount?: number;
  platform: SupportedPlatform;
  url: string;
  formats: MediaFormat[];
  bestVideo?: MediaFormat;
  bestAudio?: MediaFormat;
  isPlaylist: boolean;
  playlistCount?: number;
}

export interface DownloadJob {
  id: string;
  url: string;
  platform: SupportedPlatform;
  title: string;
  thumbnail?: string;
  duration?: number;
  status: DownloadStatus;
  progress: number;
  downloadProgress?: number;
  convertProgress?: number;
  mode: 'video' | 'audio';
  selectedFormat?: string;
  selectedResolution?: string;
  audioFormat?: AudioFormat;
  audioBitrate?: number;
  outputPath?: string;
  fileSize?: number;
  errorMessage?: string;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
  };
  createdAt: number;
  completedAt?: number;
}

export const users = {} as any;
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
