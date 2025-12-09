/**
 * API Client for calling the Python backend (deployed on Railway)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface GenerateRequest {
  api_key: string;
  prompt: string;
  aspect_ratio?: string;
  asset_urls?: string[];
}

export interface GenerateResponse {
  success: boolean;
  image_url?: string;
  error?: string;
}

export interface EnlargeRequest {
  api_key: string;
  image_url: string;
}

export interface EnlargeResponse {
  success: boolean;
  image_url?: string;
  error?: string;
}

/**
 * Generate a slide image
 */
export async function generateSlide(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${text}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Enlarge/upscale an image
 */
export async function enlargeSlide(request: EnlargeRequest): Promise<EnlargeResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/enlarge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${text}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}


