# Video to MP3 Converter

## Overview
A next-generation Video to MP3 Converter web application with highly experimental, unconventional UI/UX. Features a bright, high-contrast light theme (dark mode strictly forbidden) with gradients, glassmorphism, depth layers, and animated surfaces.

## Tech Stack
- Frontend: React, Vite, TailwindCSS, Framer Motion
- Backend: Express.js, FFmpeg (fluent-ffmpeg)
- Real-time: WebSocket for progress updates
- Storage: In-memory storage for job tracking

## Key Features
- Convert video files (MP4, MKV, AVI, MOV, WEBM) to high-quality MP3
- Multiple bitrate options: 64, 128, 192, 320 kbps
- Batch conversion with queue management
- Drag & drop file upload
- Real-time progress visualization with waveform animation
- Audio player with playback controls
- Audio trimming controls
- Metadata editing (title, artist, album)

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
server/
  routes.ts          # API endpoints
  storage.ts         # In-memory job storage
shared/
  schema.ts          # Shared types
```

## Design System
- Light theme only - NO dark mode
- Primary colors: Cyan (195 100% 50%), Blue (210 100% 55%)
- Accent colors: Magenta (320 85% 55%), Lime (140 80% 45%)
- Glassmorphism: backdrop-filter blur, semi-transparent backgrounds
- Animated floating orbs for depth
- Custom shadows with colored glow effects

## API Endpoints
- POST /api/upload - Upload video file with jobId and bitrate
- POST /api/upload-url - URL-based upload (stubbed)
- POST /api/convert - Start conversion with jobId, bitrate, trim, metadata
- GET /api/download/:jobId - Download converted MP3
- GET /api/stream/:jobId - Stream audio for preview
- GET /api/jobs - List all jobs
- GET /api/jobs/:id - Get single job
- DELETE /api/jobs/:id - Delete job and files

## Recent Changes (Jan 28, 2026)
- Fixed critical job identity issues: proper jobId tracking throughout lifecycle
- Jobs now store input file path for correct conversion
- Conversion and download tied to specific jobs (not latest file)
- FFmpeg applies metadata (-metadata flags) and trimming (-ss/-to flags)
- WebSocket broadcasts progress updates to all connected clients
