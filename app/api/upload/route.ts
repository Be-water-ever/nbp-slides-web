import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

// Increase body size limit to 50MB for image uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

// Route segment config for App Router
export const maxDuration = 60;

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

