/**
 * Export utilities for slides - PNG, PDF, PPTX
 */

import { GeneratedSlide, TextBlock } from "@/app/page";

// Slide dimensions (16:9 aspect ratio)
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// Font size mapping for different text sizes
function getFontSizeInPx(size: string): number {
  switch (size) {
    case "large": return 77; // ~4vw at 1920px
    case "medium": return 48; // ~2.5vw
    case "small": return 35; // ~1.8vw
    case "tiny": return 23; // ~1.2vw
    default: return 38;
  }
}

// Font size in points for PDF/PPTX
function getFontSizeInPt(size: string): number {
  switch (size) {
    case "large": return 58;
    case "medium": return 36;
    case "small": return 26;
    case "tiny": return 17;
    default: return 29;
  }
}

// Load image as HTMLImageElement
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Convert image URL to base64 data URL
async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Render a slide (background + text) to a canvas
 */
export async function renderSlideToCanvas(
  slide: GeneratedSlide,
  canvas: HTMLCanvasElement
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;

  // Get the best image URL (clean > enlarged > original)
  const imageUrl = slide.cleanPath || slide.enlarged || slide.path;

  // Draw background image
  const img = await loadImage(imageUrl);
  
  // Calculate scaling to fit canvas while maintaining aspect ratio
  const scale = Math.min(SLIDE_WIDTH / img.width, SLIDE_HEIGHT / img.height);
  const x = (SLIDE_WIDTH - img.width * scale) / 2;
  const y = (SLIDE_HEIGHT - img.height * scale) / 2;
  
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  // Draw text blocks (only if slide has cleanPath - meaning text was extracted)
  if (slide.cleanPath && slide.textBlocks && slide.textBlocks.length > 0) {
    for (const block of slide.textBlocks) {
      const fontSize = getFontSizeInPx(block.size);
      const fontWeight = block.size === "large" ? "600" : "400";
      
      ctx.font = `${fontWeight} ${fontSize}px Inter, SF Pro Display, -apple-system, sans-serif`;
      ctx.fillStyle = block.color || "#333333";
      ctx.textAlign = block.align as CanvasTextAlign || "center";
      ctx.textBaseline = "middle";

      // Calculate position (percentage to pixels)
      const textX = (block.x_percent / 100) * SLIDE_WIDTH;
      const textY = (block.y_percent / 100) * SLIDE_HEIGHT;

      // Handle multiline text
      const lines = block.content.split("\n");
      const lineHeight = fontSize * 1.3;
      const totalHeight = lines.length * lineHeight;
      const startY = textY - totalHeight / 2 + lineHeight / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, textX, startY + index * lineHeight);
      });
    }
  }
}

/**
 * Export a single slide as PNG
 */
export async function exportSlideAsPNG(slide: GeneratedSlide): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderSlideToCanvas(slide, canvas);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create PNG blob"));
    }, "image/png");
  });
}

/**
 * Export all slides as PDF
 */
export async function exportSlidesAsPDF(slides: GeneratedSlide[]): Promise<Blob> {
  // Dynamically import jsPDF to avoid SSR issues
  const { jsPDF } = await import("jspdf");
  
  // A4 landscape dimensions in mm (we'll use 16:9 custom size)
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [297, 167], // 16:9 aspect ratio close to A4 width
  });

  const pageWidth = 297;
  const pageHeight = 167;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    
    if (i > 0) {
      doc.addPage();
    }

    // Get image URL and convert to base64
    const imageUrl = slide.cleanPath || slide.enlarged || slide.path;
    const imageData = await imageUrlToBase64(imageUrl);

    // Add background image
    doc.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight);

    // Add text blocks (only for slides with extracted text)
    if (slide.cleanPath && slide.textBlocks && slide.textBlocks.length > 0) {
      for (const block of slide.textBlocks) {
        const fontSize = getFontSizeInPt(block.size) * 0.35; // Scale down for PDF
        
        doc.setFontSize(fontSize);
        doc.setTextColor(block.color || "#333333");

        // Calculate position
        const textX = (block.x_percent / 100) * pageWidth;
        const textY = (block.y_percent / 100) * pageHeight;

        // Set alignment
        const align = block.align || "center";
        
        // Handle multiline text
        const lines = block.content.split("\n");
        const lineHeight = fontSize * 0.5;
        const totalHeight = lines.length * lineHeight;
        const startY = textY - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, index) => {
          doc.text(line, textX, startY + index * lineHeight, { align: align as "left" | "center" | "right" });
        });
      }
    }
  }

  return doc.output("blob");
}

/**
 * Export all slides as PPTX with editable text boxes
 */
export async function exportSlidesAsPPTX(slides: GeneratedSlide[]): Promise<Blob> {
  // Dynamically import pptxgenjs to avoid SSR issues
  const PptxGenJS = (await import("pptxgenjs")).default;
  
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = "NBP Slides Presentation";

  for (const slide of slides) {
    const pptSlide = pptx.addSlide();

    // Get image URL and convert to base64
    const imageUrl = slide.cleanPath || slide.enlarged || slide.path;
    const imageData = await imageUrlToBase64(imageUrl);

    // Add background image
    pptSlide.addImage({
      data: imageData,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });

    // Add text boxes (only for slides with extracted text)
    if (slide.cleanPath && slide.textBlocks && slide.textBlocks.length > 0) {
      for (const block of slide.textBlocks) {
        const fontSize = getFontSizeInPt(block.size);
        const fontBold = block.size === "large";
        
        // Convert percentage position to inches (PPTX uses inches)
        // 16:9 slide is 10" x 5.625"
        const slideWidthInches = 10;
        const slideHeightInches = 5.625;
        
        // Text box width based on width_percent
        const boxWidth = (block.width_percent / 100) * slideWidthInches;
        
        // Estimate text height (rough approximation)
        const lines = block.content.split("\n").length;
        const boxHeight = (fontSize / 72) * 1.5 * lines; // Convert pt to inches with line spacing
        
        // Position (center point to top-left)
        const x = ((block.x_percent / 100) * slideWidthInches) - (boxWidth / 2);
        const y = ((block.y_percent / 100) * slideHeightInches) - (boxHeight / 2);

        pptSlide.addText(block.content, {
          x: Math.max(0, x),
          y: Math.max(0, y),
          w: boxWidth,
          h: boxHeight,
          fontSize: fontSize,
          fontFace: "Arial",
          color: block.color?.replace("#", "") || "333333",
          bold: fontBold,
          align: block.align as "left" | "center" | "right" || "center",
          valign: "middle",
        });
      }
    }
  }

  // Generate PPTX blob
  const data = await pptx.write({ outputType: "blob" });
  return data as Blob;
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export single slide as PNG and download
 */
export async function downloadSlideAsPNG(slide: GeneratedSlide, slideNumber: number): Promise<void> {
  const blob = await exportSlideAsPNG(slide);
  downloadBlob(blob, `slide_${slideNumber}.png`);
}

/**
 * Export all slides as individual PNGs (zipped would be better but keeping simple)
 */
export async function downloadAllSlidesAsPNG(slides: GeneratedSlide[]): Promise<void> {
  for (const slide of slides) {
    await downloadSlideAsPNG(slide, slide.number);
    // Small delay to prevent browser issues
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Export all slides as PDF and download
 */
export async function downloadSlidesAsPDF(slides: GeneratedSlide[]): Promise<void> {
  const blob = await exportSlidesAsPDF(slides);
  downloadBlob(blob, "presentation.pdf");
}

/**
 * Export all slides as PPTX and download
 */
export async function downloadSlidesAsPPTX(slides: GeneratedSlide[]): Promise<void> {
  const blob = await exportSlidesAsPPTX(slides);
  downloadBlob(blob, "presentation.pptx");
}

