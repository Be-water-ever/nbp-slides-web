/**
 * Gemini API适配器 - 兼容Google官方API和云雾AI代理
 * 
 * 支持两种API Provider：
 * 1. Google官方: AIza开头的密钥，直接调用Google Gemini API
 * 2. 云雾AI代理: sk-开头的密钥，通过云雾AI调用Gemini API
 */

export enum ApiProvider {
  GOOGLE_OFFICIAL = 'google',
  YUNWU_PROXY = 'yunwu'
}

export interface GeminiConfig {
  apiKey: string;
  provider: ApiProvider;
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export interface GenerateImageRequest {
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  refImages?: Array<{
    data: string; // base64
    mimeType: string;
  }>;
}

export interface GenerateImageResponse {
  images: Array<{
    data: string; // base64
    mimeType: string;
  }>;
  error?: string;
}

/**
 * 检测API密钥类型并返回对应的Provider
 */
export function detectApiProvider(apiKey: string): ApiProvider {
  if (apiKey.startsWith('AIza')) {
    return ApiProvider.GOOGLE_OFFICIAL;
  } else if (apiKey.startsWith('sk-')) {
    return ApiProvider.YUNWU_PROXY;
  } else {
    throw new Error('Unsupported API key format. Expected AIza* (Google) or sk-* (YunWu)');
  }
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(apiKey: string): GeminiConfig {
  const provider = detectApiProvider(apiKey);
  
  return {
    apiKey,
    provider,
    baseUrl: provider === ApiProvider.GOOGLE_OFFICIAL 
      ? 'https://generativelanguage.googleapis.com/v1beta'
      : 'https://yunwu.ai/v1beta',
    model: provider === ApiProvider.GOOGLE_OFFICIAL
      ? 'gemini-pro-vision'
      : 'gemini-3-pro-image-preview',
    timeout: 60000
  };
}

/**
 * 统一的Gemini API适配器类
 */
export class GeminiAdapter {
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
  }

  /**
   * 生成图片
   */
  async generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    try {
      switch (this.config.provider) {
        case ApiProvider.GOOGLE_OFFICIAL:
          return await this.callGoogleApi(request);
        case ApiProvider.YUNWU_PROXY:
          return await this.callYunwuApi(request);
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
    } catch (error) {
      return {
        images: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 调用Google官方API
   */
  private async callGoogleApi(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    const parts: any[] = [{ text: request.prompt }];
    
    // 添加参考图片
    if (request.refImages) {
      for (const img of request.refImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data
          }
        });
      }
    }

    const payload = {
      contents: [{
        role: 'user',
        parts: parts
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeout || 60000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Google API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return this.parseGoogleResponse(data);
  }

  /**
   * 调用云雾AI代理API
   */
  private async callYunwuApi(request: GenerateImageRequest): Promise<GenerateImageResponse> {
    const modelPath = this.config.model?.startsWith('models/') 
      ? this.config.model 
      : `models/${this.config.model}`;
    
    const url = `${this.config.baseUrl}/${modelPath}:generateContent?key=${this.config.apiKey}`;
    
    const parts: any[] = [{ text: request.prompt }];
    
    // 添加参考图片
    if (request.refImages) {
      for (const img of request.refImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data
          }
        });
      }
    }

    const payload = {
      contents: [{
        role: 'user',
        parts: parts
      }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: request.aspectRatio || '16:9',
          imageSize: request.imageSize || '2K'
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeout || 60000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`YunWu API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return this.parseYunwuResponse(data);
  }

  /**
   * 解析Google API响应
   */
  private parseGoogleResponse(data: any): GenerateImageResponse {
    const images: Array<{ data: string; mimeType: string }> = [];
    
    // Google API主要返回文本，如果需要图片需要使用专门的图片生成模型
    // 这里假设返回格式，实际需要根据Google的响应格式调整
    const candidates = data.candidates || [];
    
    for (const candidate of candidates) {
      const content = candidate.content || {};
      const parts = content.parts || [];
      
      for (const part of parts) {
        if (part.inline_data) {
          images.push({
            data: part.inline_data.data,
            mimeType: part.inline_data.mime_type || 'image/png'
          });
        }
      }
    }

    return { images };
  }

  /**
   * 解析云雾AI响应
   */
  private parseYunwuResponse(data: any): GenerateImageResponse {
    const images: Array<{ data: string; mimeType: string }> = [];
    
    const candidates = data.candidates || [];
    
    for (const candidate of candidates) {
      const content = candidate.content || {};
      const parts = content.parts || [];
      
      for (const part of parts) {
        const inlineData = part.inline_data || part.inlineData;
        if (inlineData && inlineData.data) {
          images.push({
            data: inlineData.data,
            mimeType: inlineData.mime_type || inlineData.mimeType || 'image/png'
          });
        }
      }
    }

    return { images };
  }
}

/**
 * 便捷函数：自动检测API类型并创建适配器
 */
export function createGeminiAdapter(apiKey: string, options?: Partial<GeminiConfig>): GeminiAdapter {
  const defaultConfig = getDefaultConfig(apiKey);
  const config = { ...defaultConfig, ...options };
  return new GeminiAdapter(config);
}

/**
 * 便捷函数：快速生成图片
 */
export async function generateImageWithAutoDetect(
  apiKey: string, 
  prompt: string, 
  options?: {
    aspectRatio?: string;
    imageSize?: string;
    refImages?: Array<{ data: string; mimeType: string }>;
  }
): Promise<GenerateImageResponse> {
  const adapter = createGeminiAdapter(apiKey);
  return adapter.generateImage({
    prompt,
    aspectRatio: options?.aspectRatio,
    imageSize: options?.imageSize,
    refImages: options?.refImages
  });
}