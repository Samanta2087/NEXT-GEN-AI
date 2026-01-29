# Image & PDF Tool Suite - Professional Grade

## 🎨 Overview

This is a **desktop-grade creative studio** built for the browser. It combines professional image processing and PDF manipulation tools with a sophisticated, layered UI that feels like premium software.

### Design Philosophy

- **Light Theme Only** - Bright, high-contrast, glassmorphic design
- **Desktop-Grade UX** - Multi-panel workspace with live previews
- **Power User Focused** - Batch processing, keyboard shortcuts, precision controls
- **Non-Destructive Workflow** - Original files always preserved
- **Real-Time Feedback** - Live before/after comparisons

---

## 🖼️ Image Tools

### Core Features

1. **Convert** - Transform between JPG, PNG, WEBP
   - Format-specific optimization
   - Quality control with visual preview
   - Mozjpeg for superior JPG compression

2. **Resize** - Precision scaling with aspect lock
   - Quick presets (Icon, Thumbnail, Small, Medium, Large, 4K)
   - Custom pixel dimensions
   - Aspect ratio lock/unlock
   - Smart upscaling prevention

3. **Compress** - Intelligent file size reduction
   - Quality slider (10-100%)
   - Target size mode (auto-adjust quality)
   - Real-time size estimation
   - Visual degradation preview

4. **Crop** - Professional framing tools
   - Grid overlay (rule of thirds)
   - Freeform selection
   - Preset aspect ratios (1:1, 4:3, 16:9, 3:2, 9:16)
   - Pixel-precise positioning

5. **Rotate/Flip** - Transform orientation
   - 90° clockwise/counter-clockwise
   - Horizontal/vertical flip
   - Custom angle rotation
   - Auto-straighten

6. **Remove Background** - Subject extraction
   - Alpha channel preservation
   - Edge refinement
   - PNG output with transparency

7. **Image to PDF** - Document conversion
   - Single or batch conversion
   - Page size optimization
   - Metadata embedding

8. **Strip EXIF** - Privacy protection
   - Remove all metadata
   - GPS data removal
   - Camera info cleanup

### Advanced Image Features

- **Batch Processing** - Process up to 50 images simultaneously
- **Before/After Slider** - Interactive comparison with drag handle
- **Resolution Ladder** - Quick preset selection (32px - 4K)
- **Auto Optimize** - AI-powered quality settings
- **Size Preview** - Estimated output size before processing
- **Quality Indicators** - Color-coded quality levels

---

## 📄 PDF Tools

### Core Features

1. **Merge PDFs** - Combine multiple documents
   - Drag-and-drop reordering
   - Visual page thumbnails
   - Password-protected detection

2. **Split PDF** - Extract pages
   - Page range selection
   - Auto-split by size/pages
   - Batch output naming

3. **Compress PDF** - Reduce file size
   - Low/Medium/High compression levels
   - Quality vs size tradeoff control
   - Size estimation preview

4. **Rotate Pages** - Orientation correction
   - 90°/180°/270° rotation
   - Individual or all pages
   - Visual page preview

5. **PDF to Images** - Export pages
   - JPG or PNG output
   - Quality control
   - Per-page or batch export
   - Custom DPI

6. **Delete Pages** - Remove unwanted pages
   - Multi-select interface
   - Visual confirmation
   - Undo support

7. **Reorder Pages** - Rearrange sequence
   - Drag-and-drop interface
   - Visual page timeline
   - Bulk operations

### Advanced PDF Features

- **Page Thumbnails** - Live visual timeline of all pages
- **Metadata Viewer** - Display title, author, creation date
- **Password Detection** - Handle encrypted PDFs gracefully
- **Batch Operations** - Process multiple PDFs at once

---

## 🎨 UI/UX Design

### Visual Language

- **Glassmorphism** - Frosted glass effects with backdrop blur
- **Layered Depth** - Multiple z-index levels with shadows
- **Neon Accents** - Subtle blue/purple gradients for interaction
- **Noise Texture** - Fine grain overlay for premium feel
- **Smooth Animations** - Framer Motion transitions everywhere

### Layout Structure

```
┌─────────────────────────────────────────┐
│           Header Bar (Sticky)           │
├───────────┬─────────────┬───────────────┤
│   Input   │   Preview   │   Controls    │
│   Panel   │   Panel     │   Panel       │
│           │             │               │
│ • Upload  │ • Before/   │ • Format      │
│ • Files   │   After     │ • Quality     │
│ • Batch   │ • Live      │ • Resize      │
│ • Select  │   Compare   │ • Settings    │
│           │             │ • Process     │
└───────────┴─────────────┴───────────────┘
```

### Color System

- **Primary**: Blue 600 (`#2563eb`)
- **Accent**: Purple 600 (`#9333ea`)
- **Success**: Green 600 (`#16a34a`)
- **Warning**: Orange 600 (`#ea580c`)
- **Danger**: Red 600 (`#dc2626`)

### Component Hierarchy

1. **Tool Selection View** - Grid of tool cards
2. **Workspace View** - Three-panel layout
3. **Before/After Slider** - Interactive comparison
4. **Processing Pipeline** - Staged progress indicator
5. **Controls Panel** - Context-sensitive settings

---

## 🔧 Technical Architecture

### Frontend Stack

- **React 18** - Component framework
- **TypeScript** - Type safety
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling system
- **Radix UI** - Accessible components
- **Wouter** - Routing

### Backend Stack

- **Express** - Server framework
- **Sharp** - Image processing
- **PDF-Lib** - PDF manipulation
- **Multer** - File uploads
- **WebSocket** - Real-time progress

### File Structure

```
client/src/
├── components/
│   ├── BeforeAfterSlider.tsx      # Interactive comparison
│   ├── ProcessingPipeline.tsx     # Stage indicator
│   └── ui/                         # Radix components
├── pages/
│   ├── ToolsNew.tsx               # Main tool suite
│   └── ...
└── lib/
    └── utils.ts                    # Helpers

server/
├── imageProcessor.ts               # Sharp integration
├── pdfProcessor.ts                 # PDF-Lib integration
└── routes.ts                       # API endpoints
```

---

## 🚀 API Endpoints

### Image Processing

```typescript
POST /api/image/upload          // Upload image file
GET  /api/image/metadata/:id    // Get image metadata
POST /api/image/process         // Process image
POST /api/image/batch           // Batch process
GET  /api/image/download/:id    // Download result
GET  /api/image/jobs            // List all jobs
DELETE /api/image/jobs/:id      // Delete job
```

### PDF Processing

```typescript
POST /api/pdf/upload            // Upload PDF file
GET  /api/pdf/metadata/:id      // Get PDF metadata
POST /api/pdf/merge             // Merge PDFs
POST /api/pdf/split             // Split PDF
POST /api/pdf/rotate            // Rotate pages
POST /api/pdf/delete-pages      // Delete pages
POST /api/pdf/reorder           // Reorder pages
POST /api/pdf/compress          // Compress PDF
POST /api/pdf/to-images         // Export to images
GET  /api/pdf/download/:id      // Download result
GET  /api/pdf/jobs              // List all jobs
DELETE /api/pdf/jobs/:id        // Delete job
```

---

## 📦 Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
npm start
```

---

## 🎯 Usage Examples

### Convert Image Format

1. Select "Convert" tool
2. Upload JPG/PNG/WEBP files
3. Select output format (JPG/PNG/WEBP)
4. Adjust quality slider
5. Click "Process"
6. Download converted files

### Resize Image with Presets

1. Select "Resize" tool
2. Upload images
3. Click preset (Icon, Thumbnail, Large, 4K)
4. Toggle aspect lock if needed
5. Process and download

### Compress to Target Size

1. Select "Compress" tool
2. Upload images
3. Enable "Target Size" toggle
4. Enter desired size in KB (e.g., 200)
5. Process - quality auto-adjusts

### Merge PDFs

1. Select "Merge PDFs" tool
2. Upload multiple PDF files
3. Drag to reorder
4. Click "Process"
5. Download merged PDF

---

## ⚙️ Configuration

### Image Settings

```typescript
interface ImageSettings {
  outputFormat?: "jpg" | "png" | "webp" | "pdf";
  width?: number;              // Target width in pixels
  height?: number;             // Target height in pixels
  maintainAspect?: boolean;    // Lock aspect ratio
  quality?: number;            // 10-100
  targetSize?: number;         // Target KB size
  cropX?: number;              // Crop position X
  cropY?: number;              // Crop position Y
  cropWidth?: number;          // Crop width
  cropHeight?: number;         // Crop height
  rotation?: number;           // 0, 90, 180, 270
  flipH?: boolean;             // Flip horizontal
  flipV?: boolean;             // Flip vertical
}
```

### PDF Settings

```typescript
interface PdfSettings {
  pages?: number[];                        // Page selection
  splitRange?: string;                     // "1-5,7,9-12"
  imageFormat?: "jpg" | "png";            // Export format
  imageQuality?: number;                   // Export quality
  rotation?: number;                       // Page rotation
  compressionLevel?: "low" | "medium" | "high";
  pageOrder?: number[];                    // Reorder sequence
}
```

---

## 🎨 Customization

### Theme Colors

Edit `client/src/index.css`:

```css
:root {
  --primary: 195 100% 45%;        /* Cyan */
  --accent: 280 85% 60%;          /* Magenta */
  --secondary: 220 15% 92%;       /* Neutral */
}
```

### Tool Gradients

Edit `client/src/pages/ToolsNew.tsx`:

```typescript
const TOOLS: ToolDefinition[] = [
  {
    id: "convert",
    gradient: "from-blue-500/20 to-cyan-500/20",
    color: "text-blue-600",
    // ...
  }
];
```

---

## 🔒 Security

- **File Size Limits** - 50MB per image, 100MB per PDF
- **File Type Validation** - Server-side MIME type checking
- **Temporary Storage** - Auto-cleanup after processing
- **No Cloud Upload** - All processing happens locally
- **EXIF Stripping** - Remove metadata for privacy

---

## 🚧 Limitations

- Max 50 files per batch
- No RAW image format support (yet)
- PDF password unlocking not supported
- Background removal requires API key
- Max processing time: 5 minutes per job

---

## 🎯 Future Enhancements

- [ ] RAW image format support (CR2, NEF, ARW)
- [ ] Video thumbnail extraction
- [ ] Watermark addition
- [ ] Bulk rename utility
- [ ] Cloud storage integration (optional)
- [ ] Collaborative editing
- [ ] Version history
- [ ] Keyboard shortcuts panel
- [ ] Drag-and-drop workspace
- [ ] Custom tool presets
- [ ] Export/import settings

---

## 📝 License

MIT License - see LICENSE file

---

## 🙏 Credits

- **Sharp** - High-performance image processing
- **PDF-Lib** - PDF manipulation
- **Framer Motion** - Animation library
- **Radix UI** - Accessible components
- **Tailwind CSS** - Utility-first CSS

---

## 📞 Support

For issues or questions, please open a GitHub issue.

---

**Built with precision. Designed for professionals.**
