import { NextRequest, NextResponse } from "next/server";

// API URL for the Python backend (Railway)
const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, imageUrl } = body;

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 400 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    // Call the remote Python backend
    const response = await fetch(`${API_BASE_URL}/enlarge`, {
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

    if (result.success && result.image_url) {
      return NextResponse.json({
        success: true,
        enlargedPath: result.image_url,
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Enlargement failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Enlarge API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
