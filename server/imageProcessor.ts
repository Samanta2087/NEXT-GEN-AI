import sharp from "sharp";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
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
    exif: metadata.exif,
    colorSpace: metadata.space,
    density: metadata.density,
  };
}

export async function batchProcessImages(
  inputPaths: string[],
  operation: ImageOperation,
  settings: ImageSettings,
  onProgress?: (index: number, total: number, progress: number) => void
): Promise<{ results: { outputPath: string; outputSize: number; originalName: string }[] }> {
  const results: { outputPath: string; outputSize: number; originalName: string }[] = [];
  
  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    const ext = settings.outputFormat || "jpg";
    const outputPath = path.join(OUTPUT_DIR, `batch_${Date.now()}_${i}.${ext}`);
    
    const result = await processImage(inputPath, outputPath, operation, settings, (progress) => {
      onProgress?.(i, inputPaths.length, progress);
    });
    
    results.push({
      ...result,
      originalName: path.basename(inputPath),
    });
  }
  
  return { results };
}

export async function removeBackground(
  inputPath: string,
  outputPath: string
): Promise<{ outputPath: string; outputSize: number }> {
  console.log("[RemoveBG] Starting AI-powered background removal with Python rembg...");
  console.log("[RemoveBG] Input:", inputPath);
  console.log("[RemoveBG] Output:", outputPath);
  
  return new Promise((resolve, reject) => {
    // Use Python script for rembg (avoids CLI JIT compilation issues)
    const scriptPath = path.join(process.cwd(), "script", "remove_bg.py");
    
    // Quote paths to handle spaces in Windows paths
    const quotedScript = `"${scriptPath}"`;
    const quotedInput = `"${inputPath}"`;
    const quotedOutput = `"${outputPath}"`;
    
    console.log("[RemoveBG] Running:", `python ${quotedScript} ${quotedInput} ${quotedOutput}`);
    
    const rembgProcess = spawn("python", [quotedScript, quotedInput, quotedOutput], {
      shell: true,
    });
    
    let stderr = "";
    
    rembgProcess.stdout.on("data", (data) => {
      console.log("[RemoveBG]", data.toString());
    });
    
    rembgProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.log("[RemoveBG stderr]", data.toString());
    });
    
    rembgProcess.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log("[RemoveBG] Success! Output size:", stats.size, "bytes");
        resolve({
          outputPath,
          outputSize: stats.size,
        });
      } else {
        console.error("[RemoveBG] rembg failed with code:", code);
        console.error("[RemoveBG] stderr:", stderr);
        
        // Fallback to basic removal
        console.log("[RemoveBG] Falling back to basic color-based removal...");
        removeBackgroundBasic(inputPath, outputPath)
          .then(resolve)
          .catch(reject);
      }
    });
    
    rembgProcess.on("error", (error) => {
      console.error("[RemoveBG] Failed to start rembg:", error.message);
      console.log("[RemoveBG] Falling back to basic color-based removal...");
      removeBackgroundBasic(inputPath, outputPath)
        .then(resolve)
        .catch(reject);
    });
  });
}

// Fallback basic background removal (for when rembg is unavailable)
async function removeBackgroundBasic(
  inputPath: string,
  outputPath: string
): Promise<{ outputPath: string; outputSize: number }> {
  const image = sharp(inputPath);
  
  // Get raw pixel data
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  
  // Simple background detection - assume corners are background
  const cornerSamples = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];
  
  let bgR = 0, bgG = 0, bgB = 0;
  for (const corner of cornerSamples) {
    const idx = (corner.y * width + corner.x) * channels;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);
  
  // Create new buffer with transparency
  const newData = Buffer.alloc(data.length);
  const tolerance = 50;
  
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - bgR, 2) + 
      Math.pow(g - bgG, 2) + 
      Math.pow(b - bgB, 2)
    );
    
    newData[i] = r;
    newData[i + 1] = g;
    newData[i + 2] = b;
    
    if (distance < tolerance) {
      newData[i + 3] = 0;
    } else if (distance < tolerance * 2) {
      newData[i + 3] = Math.min(255, Math.round((distance - tolerance) / tolerance * 255));
    } else {
      newData[i + 3] = 255;
    }
  }
  
  await sharp(newData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toFile(outputPath);
    
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
  };
}

export async function imageToPdf(
  inputPath: string,
  outputPath: string,
  settings: ImageSettings
): Promise<{ outputPath: string; outputSize: number }> {
  const { PDFDocument } = await import("pdf-lib");
  
  const pdfDoc = await PDFDocument.create();
  const imageBytes = fs.readFileSync(inputPath);
  const ext = path.extname(inputPath).toLowerCase();
  
  let image;
  if (ext === ".jpg" || ext === ".jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
  } else if (ext === ".png") {
    image = await pdfDoc.embedPng(imageBytes);
  } else {
    // Convert to PNG first
    const pngBuffer = await sharp(inputPath).png().toBuffer();
    image = await pdfDoc.embedPng(pngBuffer);
  }
  
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
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
  
  console.log(`[ImageProcessor] Processing: ${operation}`, JSON.stringify(settings));
  
  switch (operation) {
    case "convert":
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "resize":
      pipeline = applyResize(pipeline, settings);
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "compress":
      // Apply compression with quality settings
      pipeline = applyCompression(pipeline, settings);
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "crop":
      if (settings.cropX !== undefined && settings.cropY !== undefined &&
          settings.cropWidth && settings.cropHeight) {
        console.log(`[ImageProcessor] Cropping: x=${settings.cropX}, y=${settings.cropY}, w=${settings.cropWidth}, h=${settings.cropHeight}`);
        pipeline = pipeline.extract({
          left: Math.round(settings.cropX),
          top: Math.round(settings.cropY),
          width: Math.round(settings.cropWidth),
          height: Math.round(settings.cropHeight),
        });
      } else {
        console.log(`[ImageProcessor] Crop: No coordinates provided, outputting as-is`);
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "rotate":
      if (settings.rotation) {
        console.log(`[ImageProcessor] Rotating: ${settings.rotation}°`);
        pipeline = pipeline.rotate(settings.rotation, { background: { r: 255, g: 255, b: 255, alpha: 0 } });
      }
      // Also handle flip if present
      if (settings.flipH) {
        pipeline = pipeline.flop();
      }
      if (settings.flipV) {
        pipeline = pipeline.flip();
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "flip":
      if (settings.flipH) {
        console.log(`[ImageProcessor] Flipping horizontally`);
        pipeline = pipeline.flop();
      }
      if (settings.flipV) {
        console.log(`[ImageProcessor] Flipping vertically`);
        pipeline = pipeline.flip();
      }
      pipeline = applyFormat(pipeline, settings);
      break;
      
    case "strip-exif":
    case "strip":
      console.log(`[ImageProcessor] Stripping EXIF metadata`);
      // Remove EXIF by re-encoding without metadata
      pipeline = pipeline.rotate(); // Auto-rotate based on EXIF then strip
      pipeline = applyFormat(pipeline, settings);
      break;
    
    case "to-pdf":
      // Use dedicated imageToPdf function
      onProgress?.(50);
      const pdfOutputPath = outputPath.replace(/\.[^.]+$/, '.pdf');
      const pdfResult = await imageToPdf(inputPath, pdfOutputPath, settings);
      onProgress?.(100);
      return pdfResult;
    
    case "remove-bg":
      // Use dedicated removeBackground function
      onProgress?.(50);
      const bgResult = await removeBackground(inputPath, outputPath);
      onProgress?.(100);
      return bgResult;
      
    default:
      console.log(`[ImageProcessor] Unknown operation: ${operation}, applying format only`);
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
