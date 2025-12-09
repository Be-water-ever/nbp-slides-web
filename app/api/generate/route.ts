import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob, addSlideToJob, getJob } from "@/lib/job-store";
import { parseOutline } from "@/lib/parse-outline";
import { generateSlideImage, validateApiKey } from "@/lib/python-bridge";
import path from "path";
import fs from "fs/promises";

// Store active generation promises to prevent premature termination
const activeGenerations = new Map<string, Promise<void>>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, outline, visualGuideline, specificSlides } = body;

    // Validate API key format
    if (!apiKey || !(await validateApiKey(apiKey))) {
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

    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), "public", "generated", job.id);
    await fs.mkdir(outputDir, { recursive: true });

    // Start generation and store the promise
    const generationPromise = generateSlidesInBackground(job.id, slides, visualGuideline, apiKey, outputDir);
    activeGenerations.set(job.id, generationPromise);
    
    // Clean up when done
    generationPromise.finally(() => {
      activeGenerations.delete(job.id);
    });

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
  outputDir: string
) {
  console.log(`[Job ${jobId}] Starting generation of ${slides.length} slides...`);
  console.log(`[Job ${jobId}] Output directory: ${outputDir}`);
  
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

      const outputPrefix = path.join(outputDir, `slide_${String(slide.number).padStart(2, "0")}`);

      // Resolve asset paths relative to nbp_slides project
      const nbpSlidesPath = path.resolve(process.cwd(), process.env.NBP_SLIDES_PATH || "../nbp_slides");
      const resolvedAssetPaths: string[] = [];
      
      if (slide.assetPaths && slide.assetPaths.length > 0) {
        for (const assetPath of slide.assetPaths) {
          const fullAssetPath = path.resolve(nbpSlidesPath, assetPath);
          try {
            await fs.access(fullAssetPath);
            resolvedAssetPaths.push(fullAssetPath);
            console.log(`[Job ${jobId}] Using asset: ${fullAssetPath}`);
          } catch {
            console.warn(`[Job ${jobId}] Asset not found: ${fullAssetPath}`);
          }
        }
      }

      // Call the Python script with asset paths
      const result = await generateSlideImage(
        prompt,
        outputPrefix,
        apiKey,
        resolvedAssetPaths.length > 0 ? resolvedAssetPaths : undefined,
        (line) => {
          console.log(`[Slide ${slide.number}] ${line}`);
        }
      );

      if (result.success) {
        // Check for both .jpg and .png extensions
        const possibleExtensions = ['.jpg', '.jpeg', '.png'];
        let foundFile = false;
        
        for (const ext of possibleExtensions) {
          const generatedFile = `slide_${String(slide.number).padStart(2, "0")}_0${ext}`;
          const fullPath = path.join(outputDir, generatedFile);
          
          try {
            await fs.access(fullPath);
            const publicPath = `/generated/${jobId}/${generatedFile}`;
            addSlideToJob(jobId, publicPath);
            console.log(`[Job ${jobId}] Slide ${slide.number} generated: ${publicPath}`);
            successCount++;
            foundFile = true;
            break;
          } catch {
            // File doesn't exist with this extension, try next
          }
        }
        
        if (!foundFile) {
          const errorMsg = `Slide ${slide.number}: Generated but output file not found`;
          console.error(`[Job ${jobId}] ${errorMsg}`);
          errors.push(errorMsg);
        }
      } else {
        const errorMsg = `Slide ${slide.number}: ${result.stderr || 'Unknown error'}`;
        console.error(`[Job ${jobId}] Failed to generate slide ${slide.number}:`, result.stderr);
        errors.push(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Slide ${slide.number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
      // Don't override progress - let it be calculated from completedSlides
      updateJob(jobId, { status: "completed" });
      console.log(`[Job ${jobId}] Completed - ${successCount}/${slides.length} slides generated`);
    }
  }
}

