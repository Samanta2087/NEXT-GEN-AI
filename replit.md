# Video to MP3 Converter

## Overview

A web-based video to MP3 converter application that allows users to upload video files and extract audio in MP3 format. The app features a modern, glassmorphic UI with real-time conversion progress via WebSockets, batch file processing, audio quality selection, metadata editing, and audio trimming capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, React hooks for local state
- **Styling**: Tailwind CSS with custom glassmorphic design system, CSS variables for theming
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Animations**: Framer Motion for smooth transitions and visual feedback
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api/` prefix
- **File Upload**: Multer for multipart form handling with 2GB file size limit
- **Media Processing**: fluent-ffmpeg for video-to-audio conversion
- **Real-time Updates**: WebSocket server (ws library) for live progress broadcasting

### Data Storage
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts` contains Zod schemas for validation and type definitions
- **Current Storage**: In-memory storage implementation (`MemStorage` class) for conversion jobs
- **File Storage**: Local filesystem with `uploads/` and `output/` directories

### Key Design Patterns
- **Monorepo Structure**: Client, server, and shared code in single repository
- **Shared Types**: Zod schemas in `shared/` directory for both validation and TypeScript types
- **Path Aliases**: `@/` for client code, `@shared/` for shared modules
- **Build Process**: Custom build script using esbuild for server bundling, Vite for client

### Conversion Workflow
1. User uploads video file(s) via drag-and-drop or file picker
2. Server creates job record and stores file in `uploads/` directory
3. FFmpeg processes video and extracts audio at selected bitrate
4. WebSocket broadcasts real-time progress to connected clients
5. Completed MP3 files stored in `output/` directory for download

## External Dependencies

### Core Services
- **PostgreSQL Database**: Required for production (DATABASE_URL environment variable)
- **FFmpeg**: System dependency for audio extraction (fluent-ffmpeg wrapper)

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: Database ORM and migration tooling
- **fluent-ffmpeg**: FFmpeg Node.js bindings for media processing
- **multer**: File upload middleware
- **ws**: WebSocket implementation for real-time progress
- **zod**: Runtime validation and schema definitions

### Frontend Libraries
- **@tanstack/react-query**: Async state management
- **framer-motion**: Animation library
- **@radix-ui/***: Accessible UI primitives
- **wouter**: Lightweight React router
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Fast bundler for production server build
- **vite**: Frontend development server and bundler