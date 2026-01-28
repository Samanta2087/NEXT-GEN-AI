import sharp from "sharp";
import path from "path";
import fs from "fs";
import type { ImageSettings, ImageMetadata, ImageOperation } from "@shared/schema";

const OUTPUT_DIR = path.join(process.cwd(), "output", "images");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function getImageMetadata(filePath: string): Promise<ImageMetadata> {
  const metadata = await sharp(filePath).metadata();
  const stats = fs.statSync(filePath);
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    size: stats.size,
    hasAlpha: metadata.hasAlpha || false,
    colorSpace: metadata.space,
    density: metadata.density,
  };
}

export async function estimateOutputSize(
  filePath: string,
  settings: ImageSettings
): Promise<number> {
  const metadata = await sharp(filePath).metadata();
  const originalSize = fs.statSync(filePath).size;
  
  let estimatedSize = originalSize;
  
  if (settings.width && settings.height && metadata.width && metadata.height) {
    const ratio = (settings.width * settings.height) / (metadata.width * metadata.height);
    estimatedSize *= ratio;
  }
  
  if (settings.quality) {
    estimatedSize *= settings.quality / 100;
  }
  
  if (settings.outputFormat === "webp") {
    estimatedSize *= 0.7;
  } else if (settings.outputFormat === "png") {
    estimatedSize *= 1.2;
  }
  
  return Math.round(estimatedSize);
}

export async function processImage(
  inputPath: string,
  outputPath: string,
  operation: ImageOperation,
  settings: ImageSettings,
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number }> {
  let pipeline = sharp(inputPath);
  
  onProgress?.(10);
  
  switch (operation) {
    case "convert":
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "resize":
      pipeline = applyResize(pipeline, settings);
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "compress":
      pipeline = applyCompression(pipeline, settings);
      break;
      
    case "crop":
      if (settings.cropX !== undefined && settings.cropY !== undefined &&
          settings.cropWidth && settings.cropHeight) {
        pipeline = pipeline.extract({
          left: Math.round(settings.cropX),
          top: Math.round(settings.cropY),
          width: Math.round(settings.cropWidth),
          height: Math.round(settings.cropHeight),
        });
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "rotate":
      if (settings.rotation) {
        pipeline = pipeline.rotate(settings.rotation, { background: { r: 255, g: 255, b: 255, alpha: 0 } });
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "flip":
      if (settings.flipH) {
        pipeline = pipeline.flop();
      }
      if (settings.flipV) {
        pipeline = pipeline.flip();
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "strip-exif":
      pipeline = pipeline.rotate();
      pipeline = applyFormat(pipeline, settings);
      break;
      
    default:
      pipeline = applyFormat(pipeline, settings);
  }
  
  onProgress?.(50);
  
  await pipeline.toFile(outputPath);
  
  onProgress?.(100);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
  };
}

function applyFormat(pipeline: sharp.Sharp, settings: ImageSettings): sharp.Sharp {
  const quality = settings.quality || 85;
  
  switch (settings.outputFormat) {
    case "jpg":
      return pipeline.jpeg({ quality, mozjpeg: true });
    case "png":
      return pipeline.png({ quality, compressionLevel: 9 });
    case "webp":
      return pipeline.webp({ quality, effort: 6 });
    default:
      return pipeline.jpeg({ quality, mozjpeg: true });
  }
}

function applyResize(pipeline: sharp.Sharp, settings: ImageSettings): sharp.Sharp {
  if (settings.width || settings.height) {
    return pipeline.resize({
      width: settings.width,
      height: settings.height,
      fit: settings.maintainAspect ? "inside" : "fill",
      withoutEnlargement: true,
    });
  }
  return pipeline;
}

function applyCompression(pipeline: sharp.Sharp, settings: ImageSettings): sharp.Sharp {
  const quality = settings.quality || 80;
  
  switch (settings.outputFormat) {
    case "jpg":
      return pipeline.jpeg({ quality, mozjpeg: true });
    case "png":
      return pipeline.png({ quality, compressionLevel: 9 });
    case "webp":
      return pipeline.webp({ quality, effort: 6 });
    default:
      return pipeline.jpeg({ quality, mozjpeg: true });
  }
}

export async function compressToTargetSize(
  inputPath: string,
  outputPath: string,
  targetSizeKB: number,
  format: "jpg" | "png" | "webp" = "jpg"
): Promise<{ outputPath: string; outputSize: number; quality: number }> {
  let minQuality = 10;
  let maxQuality = 100;
  let bestQuality = 80;
  let bestSize = Infinity;
  
  const targetBytes = targetSizeKB * 1024;
  
  for (let i = 0; i < 8; i++) {
    const testQuality = Math.round((minQuality + maxQuality) / 2);
    const testPath = outputPath.replace(/\.[^.]+$/, `_test_${i}.${format}`);
    
    let pipeline = sharp(inputPath);
    
    switch (format) {
      case "jpg":
        pipeline = pipeline.jpeg({ quality: testQuality, mozjpeg: true });
        break;
      case "png":
        pipeline = pipeline.png({ quality: testQuality });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality: testQuality });
        break;
    }
    
    await pipeline.toFile(testPath);
    const stats = fs.statSync(testPath);
    
    if (stats.size <= targetBytes && stats.size > bestSize * 0.8) {
      bestQuality = testQuality;
      bestSize = stats.size;
    }
    
    if (stats.size > targetBytes) {
      maxQuality = testQuality - 1;
    } else {
      minQuality = testQuality + 1;
    }
    
    fs.unlinkSync(testPath);
    
    if (Math.abs(stats.size - targetBytes) < targetBytes * 0.05) {
      bestQuality = testQuality;
      bestSize = stats.size;
      break;
    }
  }
  
  let pipeline = sharp(inputPath);
  
  switch (format) {
    case "jpg":
      pipeline = pipeline.jpeg({ quality: bestQuality, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ quality: bestQuality });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: bestQuality });
      break;
  }
  
  await pipeline.toFile(outputPath);
  const finalStats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: finalStats.size,
    quality: bestQuality,
  };
}

export async function createPreview(
  inputPath: string,
  maxWidth: number = 400,
  quality: number = 60
): Promise<Buffer> {
  return sharp(inputPath)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

export function getOutputPath(jobId: string, format: string): string {
  return path.join(OUTPUT_DIR, `${jobId}.${format}`);
}
