import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { registerAsset, getShortName } from "@/lib/asset-mapping";

// Route segment config for App Router  
export const maxDuration = 60;

// Note: Body size limit is now handled by Next.js runtime configuration

// R2 Configuration from environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Create S3 client for R2
function getR2Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }
  
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }
    
    // Check if R2 is configured and if we're in production
    const hasR2Config = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME;
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // 检查R2配置的有效性（不是占位符）
    const hasValidR2Config = hasR2Config && 
      R2_ACCOUNT_ID !== 'your_account_id' &&
      R2_ACCESS_KEY_ID !== 'your_access_key_id' &&
      R2_SECRET_ACCESS_KEY !== 'your_secret_access_key';
    
    // 决策逻辑：开发环境 或 R2配置无效时使用data URL
    if (isDevelopment || !hasValidR2Config) {
      const reason = isDevelopment ? "development environment" : "invalid R2 configuration";
      console.warn(`Using data URL for ${reason}`);
      
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;
      
      // 开发环境：注册映射并返回短名称
      let returnUrl: string;
      if (isDevelopment) {
        const shortName = getShortName(file.name);
        registerAsset(file.name, dataUrl);
        returnUrl = shortName;
      } else {
        returnUrl = dataUrl;
      }
      
      return NextResponse.json({
        success: true,
        url: returnUrl,
        filename: file.name,
        warning: isDevelopment 
          ? `Using short name (${returnUrl}) - paste this in outline` 
          : `Using data URL (${reason}) - configure R2 for production use`
      });
    }
    
    // 生产环境且R2配置有效时，强制检查配置完整性
    if (isProduction && !hasValidR2Config) {
      console.error("Production environment requires valid R2 configuration");
      return NextResponse.json(
        { error: "Storage service not properly configured" },
        { status: 500 }
      );
    }
    
    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `assets/${uuidv4()}.${ext}`;
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to R2
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      })
    );
    
    // Construct public URL
    let publicUrl: string;
    if (R2_PUBLIC_URL) {
      publicUrl = `${R2_PUBLIC_URL}/${filename}`;
    } else {
      publicUrl = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${filename}`;
    }
    
    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: file.name,
    });
    
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

