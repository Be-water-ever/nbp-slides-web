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

export interface ExtractTextResponse {
  success: boolean;
  clean_image_url?: string;
  text_blocks?: TextBlock[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ExtractTextResponse>> {
  try {
    const body = await request.json();
    const { apiKey, imageUrl } = body;

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json(
        { success: false, error: "Invalid API key" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Call the remote Python backend to remove text
    const response = await fetch(`${API_BASE_URL}/remove-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        image_url: imageUrl,
      }),
    });

    const result = await response.json();

    if (result.success) {
      return NextResponse.json({
        success: true,
        clean_image_url: result.clean_image_url,
        text_blocks: result.text_blocks || [],
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to extract text",
      });
    }

  } catch (error) {
    console.error("Extract text API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


