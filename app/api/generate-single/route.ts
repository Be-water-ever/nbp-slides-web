import { NextRequest, NextResponse } from "next/server";
import { 
  detectApiProvider, 
  ApiProvider, 
  generateImageWithAutoDetect 
} from "@/lib/gemini-adapter";

// API URL for the Python backend (Railway)
const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 工具函数：Blob转Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除data:前缀，只保留base64数据
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 工具函数：上传base64图片到R2存储
async function uploadBase64Image(base64Data: string, mimeType: string): Promise<string> {
  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
  
  // 检查是否有有效的 R2 配置
  const hasValidR2Config = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME &&
    R2_ACCOUNT_ID !== 'your_account_id' && 
    R2_ACCESS_KEY_ID !== 'your_access_key_id';
  
  if (!hasValidR2Config) {
    // 开发环境或无 R2 配置时使用 data URL
    console.log("No valid R2 config, using data URL");
    return `data:${mimeType};base64,${base64Data}`;
  }
  
  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { v4: uuidv4 } = await import("uuid");
    
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
    
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `slides/${uuidv4()}.${ext}`;
    const buffer = Buffer.from(base64Data, 'base64');
    
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    }));
    
    const publicUrl = R2_PUBLIC_URL 
      ? `${R2_PUBLIC_URL}/${filename}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;
    
    console.log("Uploaded to R2:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("R2 upload failed, falling back to data URL:", error);
    return `data:${mimeType};base64,${base64Data}`;
  }
}

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

    // 检测API类型并选择调用方式
    let result: any;
    
    try {
      const provider = detectApiProvider(apiKey);
      console.log(`Using ${provider} API for image generation`);
      
      if (provider === ApiProvider.GOOGLE_OFFICIAL) {
        // 对于Google官方API，仍然使用后端代理（因为需要特定的模型和配置）
        console.log("Routing to Python backend for Google API");
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
        result = await response.json();
        
      } else if (provider === ApiProvider.YUNWU_PROXY) {
        // 对于云雾AI，可以直接在前端调用（也可选择通过后端）
        console.log("Using direct YunWu API call");
        
        // 处理资产URLs转换为base64参考图片
        const refImages = [];
        if (assetUrls && assetUrls.length > 0) {
          for (const url of assetUrls.filter((p: string) => p.startsWith("http"))) {
            try {
              const imgResponse = await fetch(url);
              const blob = await imgResponse.blob();
              const base64 = await blobToBase64(blob);
              refImages.push({
                data: base64,
                mimeType: blob.type
              });
            } catch (error) {
              console.warn(`Failed to load asset: ${url}`, error);
            }
          }
        }
        
        // 直接调用适配器
        const geminiResult = await generateImageWithAutoDetect(apiKey, prompt, {
          aspectRatio: "16:9",
          imageSize: "2K",
          refImages: refImages.length > 0 ? refImages : undefined
        });
        
        if (geminiResult.error || geminiResult.images.length === 0) {
          throw new Error(geminiResult.error || "No images generated");
        }
        
        // 将base64图片上传到存储（这里需要你的存储逻辑）
        const imageUrl = await uploadBase64Image(geminiResult.images[0].data, geminiResult.images[0].mimeType);
        
        result = {
          success: true,
          image_url: imageUrl
        };
      }
    } catch (apiError) {
      console.error("API provider detection or direct call failed, falling back to backend:", apiError);
      
      // 回退到原有的后端调用方式
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
      result = await response.json();
    }

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

