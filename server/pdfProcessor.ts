import { PDFDocument, degrees } from "pdf-lib";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import type { PdfSettings, PdfMetadata, PdfOperation } from "@shared/schema";

const OUTPUT_DIR = path.join(process.cwd(), "output", "pdfs");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export async function getPdfMetadata(filePath: string): Promise<PdfMetadata> {
  const pdfBytes = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    return {
      pageCount: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate()?.toISOString(),
      modificationDate: pdfDoc.getModificationDate()?.toISOString(),
      isEncrypted: false,
      fileSize: stats.size,
    };
  } catch (error: any) {
    if (error.message?.includes("encrypted")) {
      return {
        pageCount: 0,
        isEncrypted: true,
        fileSize: stats.size,
      };
    }
    throw error;
  }
}

export async function compressPdf(
  inputPath: string,
  outputPath: string,
  level: 'low' | 'medium' | 'high' = 'medium',
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number }> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  onProgress?.(50);
  
  // Basic compression by re-saving
  const compressedBytes = await pdfDoc.save({
    useObjectStreams: level !== 'low',
    addDefaultPage: false,
  });
  
  fs.writeFileSync(outputPath, compressedBytes);
  onProgress?.(100);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
  };
}

export async function pdfToImages(
  inputPath: string,
  outputDir: string,
  format: 'jpg' | 'png' = 'png',
  quality: number = 85,
  onProgress?: (progress: number) => void
): Promise<{ outputs: { path: string; pageNumber: number; size: number; fileName?: string }[] }> {
  // Use Python PyMuPDF (fitz) for PDF to image conversion - no external dependencies
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
import fitz  # PyMuPDF
import os

input_path = sys.argv[1]
output_dir = sys.argv[2]
fmt = sys.argv[3]
quality = int(sys.argv[4])

try:
    doc = fitz.open(input_path)
    outputs = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        # Render at 2x resolution for better quality
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        
        filename = f"page_{page_num + 1}.{fmt}"
        output_path = os.path.join(output_dir, filename)
        
        if fmt == 'jpg':
            pix.save(output_path, output="jpeg", jpg_quality=quality)
        else:
            pix.save(output_path)
        
        size = os.path.getsize(output_path)
        outputs.append({
            "path": output_path,
            "pageNumber": page_num + 1,
            "size": size,
            "fileName": filename
        })
    
    doc.close()
    print(json.dumps({"success": True, "outputs": outputs}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const python = spawn('python', [
      '-c', pythonScript,
      inputPath,
      outputDir,
      format,
      quality.toString()
    ]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          onProgress?.(100);
          resolve({ outputs: result.outputs });
        } else {
          reject(new Error(result.error));
        }
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });
  });
}

export async function getPageThumbnails(
  filePath: string
): Promise<{ pageNumber: number; width: number; height: number }[]> {
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const pages = pdfDoc.getPages();
  
  return pages.map((page, index) => {
    const { width, height } = page.getSize();
    return {
      pageNumber: index + 1,
      width: Math.round(width),
      height: Math.round(height),
    };
  });
}

export async function mergePdfs(
  inputPaths: string[],
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number; pageCount: number }> {
  const mergedPdf = await PDFDocument.create();
  
  for (let i = 0; i < inputPaths.length; i++) {
    const pdfBytes = fs.readFileSync(inputPaths[i]);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    
    pages.forEach(page => mergedPdf.addPage(page));
    
    onProgress?.(Math.round(((i + 1) / inputPaths.length) * 100));
  }
  
  const mergedBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, mergedBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
    pageCount: mergedPdf.getPageCount(),
  };
}

export async function splitPdf(
  inputPath: string,
  outputDir: string,
  pageRanges: number[][],
  onProgress?: (progress: number) => void
): Promise<{ outputs: { path: string; pageCount: number; size: number }[] }> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const outputs: { path: string; pageCount: number; size: number }[] = [];
  
  for (let i = 0; i < pageRanges.length; i++) {
    const range = pageRanges[i];
    const newPdf = await PDFDocument.create();
    
    const pageIndices = range.map(p => p - 1);
    const pages = await newPdf.copyPages(pdfDoc, pageIndices);
    
    pages.forEach(page => newPdf.addPage(page));
    
    const outputPath = path.join(outputDir, `split_${i + 1}.pdf`);
    const newBytes = await newPdf.save();
    fs.writeFileSync(outputPath, newBytes);
    
    const stats = fs.statSync(outputPath);
    outputs.push({
      path: outputPath,
      pageCount: newPdf.getPageCount(),
      size: stats.size,
    });
    
    onProgress?.(Math.round(((i + 1) / pageRanges.length) * 100));
  }
  
  return { outputs };
}

export async function rotatePdfPages(
  inputPath: string,
  outputPath: string,
  pageRotations: { page: number; rotation: number }[],
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number }> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const pages = pdfDoc.getPages();
  
  for (let i = 0; i < pageRotations.length; i++) {
    const { page, rotation } = pageRotations[i];
    if (page >= 1 && page <= pages.length) {
      const currentPage = pages[page - 1];
      const currentRotation = currentPage.getRotation().angle;
      currentPage.setRotation(degrees(currentRotation + rotation));
    }
    onProgress?.(Math.round(((i + 1) / pageRotations.length) * 100));
  }
  
  const rotatedBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, rotatedBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
  };
}

export async function deletePdfPages(
  inputPath: string,
  outputPath: string,
  pagesToDelete: number[],
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number; pageCount: number }> {
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const sortedPages = [...pagesToDelete].sort((a, b) => b - a);
  
  for (let i = 0; i < sortedPages.length; i++) {
    const pageIndex = sortedPages[i] - 1;
    if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
      pdfDoc.removePage(pageIndex);
    }
    onProgress?.(Math.round(((i + 1) / sortedPages.length) * 100));
  }
  
  const modifiedBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, modifiedBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
    pageCount: pdfDoc.getPageCount(),
  };
}

export async function reorderPdfPages(
  inputPath: string,
  outputPath: string,
  newOrder: number[],
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number }> {
  const pdfBytes = fs.readFileSync(inputPath);
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const newPdf = await PDFDocument.create();
  
  for (let i = 0; i < newOrder.length; i++) {
    const pageIndex = newOrder[i] - 1;
    if (pageIndex >= 0 && pageIndex < sourcePdf.getPageCount()) {
      const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
      newPdf.addPage(copiedPage);
    }
    onProgress?.(Math.round(((i + 1) / newOrder.length) * 100));
  }
  
  const reorderedBytes = await newPdf.save();
  fs.writeFileSync(outputPath, reorderedBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
  };
}

export async function imagesToPdf(
  imagePaths: string[],
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<{ outputPath: string; outputSize: number; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  
  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const imageBytes = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    
    let image;
    if (ext === ".jpg" || ext === ".jpeg") {
      image = await pdfDoc.embedJpg(imageBytes);
    } else if (ext === ".png") {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      continue;
    }
    
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
    
    onProgress?.(Math.round(((i + 1) / imagePaths.length) * 100));
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  
  const stats = fs.statSync(outputPath);
  
  return {
    outputPath,
    outputSize: stats.size,
    pageCount: pdfDoc.getPageCount(),
  };
}

export function getOutputPath(jobId: string): string {
  return path.join(OUTPUT_DIR, `${jobId}.pdf`);
}
