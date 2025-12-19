import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob, addSlideToJob, getJob, TextBlock } from "@/lib/job-store";
import { parseOutline } from "@/lib/parse-outline";

// API URL for the Python backend (Railway)
const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, outline, visualGuideline, specificSlides, imageSize } = body;
    const normalizedImageSize: "1K" | "2K" | "4K" =
      imageSize === "2K" || imageSize === "4K" ? imageSize : "1K";

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 400 }
      );
    }

    // Parse the outline to get slides
    const slides = parseOutline(outline, 1, 99, specificSlides);
    
    if (slides.length === 0) {
      return NextResponse.json(
        { error: "No slides found in outline" },
        { status: 400 }
      );
    }

    // Create a job to track progress
    const job = createJob(slides.length);
    updateJob(job.id, { status: "processing" });

    // Start generation in background
    generateSlidesInBackground(job.id, slides, visualGuideline, apiKey, normalizedImageSize);

    return NextResponse.json({
      jobId: job.id,
      totalSlides: slides.length,
      status: "processing",
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface ParsedSlide {
  number: number;
  title: string;
  content: string;
  assetPaths: string[];
}

async function generateSlidesInBackground(
  jobId: string,
  slides: ParsedSlide[],
  visualGuideline: string,
  apiKey: string,
  imageSize: "1K" | "2K" | "4K"
) {
  console.log(`[Job ${jobId}] Starting generation of ${slides.length} slides...`);
  
  let successCount = 0;
  const errors: string[] = [];

  for (const slide of slides) {
    try {
      console.log(`[Job ${jobId}] Generating slide ${slide.number}...`);
      
      // Build the prompt
      let prompt = `
You are an expert presentation designer for a high-end tech keynote.

VISUAL GUIDELINES (MUST FOLLOW):
${visualGuideline}

SLIDE CONTENT:
${slide.content}

TASK:
Generate a high-resolution, 16:9 slide image that perfectly represents the content above while strictly adhering to the visual guidelines.
The image should be the final slide itself, including any text or graphical elements described.
Make it look like a professional slide from a Keynote presentation.
      `.trim();
      
      // Add note about provided assets
      if (slide.assetPaths && slide.assetPaths.length > 0) {
        prompt += `\n\nNOTE: Reference images have been provided. Incorporate these images into the design as described in the slide content. Use them for style reference, material textures, or embed them directly as specified.`;
      }

      // Call the remote Python backend
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          prompt: prompt,
          aspect_ratio: "16:9",
          image_size: imageSize,
          asset_urls: slide.assetPaths && slide.assetPaths.length > 0 
            ? slide.assetPaths.filter(p => p.startsWith("http")) 
            : undefined,
        }),
      });

      const result = await response.json();

      if (result.success && result.image_url) {
        // Now extract text using OCR
        let textBlocks: TextBlock[] = [];
        try {
          console.log(`[Job ${jobId}] Running OCR on slide ${slide.number}...`);
          const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              image_url: result.image_url,
            }),
          });
          const ocrResult = await ocrResponse.json();
          if (ocrResult.success && ocrResult.text_blocks) {
            textBlocks = ocrResult.text_blocks;
            console.log(`[Job ${jobId}] OCR found ${textBlocks.length} text blocks`);
          }
        } catch (ocrError) {
          console.error(`[Job ${jobId}] OCR failed (non-fatal):`, ocrError);
        }
        
        addSlideToJob(jobId, result.image_url, textBlocks);
        console.log(`[Job ${jobId}] Slide ${slide.number} generated: ${result.image_url}`);
        successCount++;
      } else {
        const errorMsg = `Slide ${slide.number}: ${result.error || 'Unknown error'}`;
        console.error(`[Job ${jobId}] ${errorMsg}`);
        errors.push(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Slide ${slide.number}: ${error instanceof Error ? error.message : 'Network error'}`;
      console.error(`[Job ${jobId}] Error generating slide ${slide.number}:`, error);
      errors.push(errorMsg);
    }
  }

  // Mark job as completed or failed
  const job = getJob(jobId);
  if (job) {
    if (successCount === 0) {
      updateJob(jobId, { 
        status: "failed", 
        error: errors.length > 0 ? errors.join('; ') : 'All slides failed to generate'
      });
      console.log(`[Job ${jobId}] Failed - no slides generated`);
    } else {
      updateJob(jobId, { status: "completed" });
      console.log(`[Job ${jobId}] Completed - ${successCount}/${slides.length} slides generated`);
    }
  }
}
