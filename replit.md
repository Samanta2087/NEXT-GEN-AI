# Video to MP3 Converter & Social Media Downloader

## Overview
A next-generation Video to MP3 Converter and Social Media Downloader with experimental, unconventional UI/UX. Features a bright, high-contrast light theme (dark mode strictly forbidden) with gradients, glassmorphism, depth layers, and animated surfaces.

## Tech Stack
- Frontend: React, Vite, TailwindCSS, Framer Motion
- Backend: Express.js, FFmpeg (fluent-ffmpeg), yt-dlp
- Real-time: WebSocket for progress updates
- Storage: In-memory storage for job tracking

## Key Features

### Video to MP3 Converter
- Convert video files (MP4, MKV, AVI, MOV, WEBM) to high-quality MP3
- Multiple bitrate options: 64, 128, 192, 320 kbps
- Batch conversion with queue management
- Drag & drop file upload
- Real-time progress visualization with waveform animation
- Audio player with playback controls
- Audio trimming controls
- Metadata editing (title, artist, album)

### Social Media Downloader
- Download from YouTube, Instagram, Facebook (via yt-dlp)
- Video mode with quality/resolution selection
- Audio mode with format (MP3, M4A, OPUS) and bitrate options
- Batch URL queue system - add multiple URLs before downloading
- Metadata editor for audio downloads (title, artist, album)
- Filename preview before download
- Download history (session-based)
- Rate limiting (3 concurrent downloads)
- Graceful error handling for age-restricted/geo-blocked content

## Project Structure
```
client/src/
  components/        # UI components
    AudioPlayer.tsx  # Audio playback with controls
    AudioTrimmer.tsx # Trim audio start/end
    BitrateSelector.tsx # Quality selection
    CompletedDownloads.tsx # Download completed files
    ConversionProgress.tsx # Progress visualization
    ConversionQueue.tsx # File queue management
    ErrorState.tsx   # Error handling UI
    FloatingOrb.tsx  # Animated background orbs
    Header.tsx       # App header
    MetadataEditor.tsx # Edit ID3 tags
    UploadZone.tsx   # Drag & drop upload
    WaveformVisualizer.tsx # Animated waveform
  hooks/
    useConversionQueue.ts # Queue state management
  pages/
    Home.tsx         # Main converter page
    Downloader.tsx   # Social media downloader page
server/
  routes.ts          # API endpoints
  storage.ts         # In-memory job storage
  ytdlp.ts           # yt-dlp integration for social media
shared/
  schema.ts          # Shared types (incl. MediaInfo, DownloadJob)
```

## Routes
- `/` - Video to MP3 Converter (Home page)
- `/downloader` - Social Media Downloader

## Design System
- Light theme only - NO dark mode
- Primary colors: Cyan (195 100% 50%), Blue (210 100% 55%)
- Accent colors: Magenta (320 85% 55%), Lime (140 80% 45%)
- Glassmorphism: backdrop-filter blur, semi-transparent backgrounds
- Animated floating orbs for depth
- Custom shadows with colored glow effects

## API Endpoints

### Converter Endpoints
- POST /api/upload - Upload video file with jobId and bitrate
- POST /api/upload-url - URL-based upload (stubbed)
- POST /api/convert - Start conversion with jobId, bitrate, trim, metadata
- GET /api/download/:jobId - Download converted MP3
- GET /api/stream/:jobId - Stream audio for preview
- GET /api/jobs - List all jobs
- GET /api/jobs/:id - Get single job
- DELETE /api/jobs/:id - Delete job and files

### Social Media Downloader Endpoints
- POST /api/social/analyze - Analyze URL for media info, available formats
- POST /api/social/download - Start download with mode, resolution, format, metadata
- GET /api/social/download/:jobId - Download completed file
- GET /api/social/jobs - List all social media jobs
- DELETE /api/social/jobs/:id - Delete job and files

## Recent Changes (Jan 28, 2026)
- Added Social Media Downloader with yt-dlp integration
- Implemented batch URL queue system for multiple downloads
- Added metadata editor for audio downloads with filename preview
- Improved error handling for rate-limited batch downloads
- Fixed component compliance (using Button variants, proper test IDs)
- WebSocket broadcasts progress updates to all connected clients
