import { NextRequest, NextResponse } from "next/server";

// API URL for the Python backend (Railway)
const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface TextBlock {
  content: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  size: "large" | "medium" | "small" | "tiny";
  align: "left" | "center" | "right";
  color: string;
}

export interface GenerateSingleResponse {
  success: boolean;
  image_url?: string;
  text_blocks?: TextBlock[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateSingleResponse>> {
  try {
    const body = await request.json();
    const { apiKey, prompt, assetUrls } = body;

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 400 }
      );
    }

    // Call the remote Python backend to generate one slide
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        prompt: prompt,
        aspect_ratio: "16:9",
        asset_urls: assetUrls && assetUrls.length > 0 
          ? assetUrls.filter((p: string) => p.startsWith("http")) 
          : undefined,
      }),
    });

    const result = await response.json();

    if (!result.success || !result.image_url) {
      return NextResponse.json({
        success: false,
        error: result.error || "Generation failed",
      });
    }

    // Now extract text using OCR
    let textBlocks: TextBlock[] = [];
    try {
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
      }
    } catch (ocrError) {
      console.error("OCR failed (non-fatal):", ocrError);
    }

    return NextResponse.json({
      success: true,
      image_url: result.image_url,
      text_blocks: textBlocks,
    });

  } catch (error) {
    console.error("Generate single API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

