import { NextRequest, NextResponse } from "next/server";
import { enlargeSlideImage, validateApiKey } from "@/lib/python-bridge";
import path from "path";
import fs from "fs/promises";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, slidePath, jobId } = body;

    // Validate API key format
    if (!apiKey || !(await validateApiKey(apiKey))) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 400 }
      );
    }

    if (!slidePath || !jobId) {
      return NextResponse.json(
        { error: "slidePath and jobId are required" },
        { status: 400 }
      );
    }

    // Convert public path to actual file path
    const inputPath = path.join(process.cwd(), "public", slidePath);
    
    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch {
      return NextResponse.json(
        { error: "Slide image not found" },
        { status: 404 }
      );
    }

    // Generate output path for 4K version
    const outputFileName = path.basename(slidePath).replace("_0.jpg", "_4k.jpg");
    const outputDir = path.join(process.cwd(), "public", "generated", jobId);
    const outputPath = path.join(outputDir, outputFileName);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Call the Python enlarge script
    const result = await enlargeSlideImage(
      inputPath,
      outputPath,
      apiKey,
      (line) => {
        console.log(`[Enlarge] ${line}`);
      }
    );

    if (result.success) {
      const publicPath = `/generated/${jobId}/${outputFileName}`;
      return NextResponse.json({
        success: true,
        enlargedPath: publicPath,
      });
    } else {
      return NextResponse.json(
        { error: result.stderr || "Enlargement failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Enlarge API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

