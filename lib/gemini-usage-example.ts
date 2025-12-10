/**
 * Gemini API适配器使用示例
 * 展示如何在现有项目中使用兼容两种API的适配器
 */

import { 
  createGeminiAdapter, 
  generateImageWithAutoDetect,
  detectApiProvider,
  ApiProvider,
  type GeminiConfig,
  type GenerateImageRequest 
} from './gemini-adapter';

/**
 * 示例1: 自动检测API类型并生成图片
 */
export async function exampleAutoDetect() {
  // Google官方API密钥
  const googleApiKey = "AIza..."; // 你的Google API Key
  
  // 云雾AI代理密钥  
  const yunwuApiKey = "sk-..."; // 你的云雾AI API Key
  
  try {
    // 使用Google官方API
    console.log('Using Google Official API...');
    const googleResult = await generateImageWithAutoDetect(
      googleApiKey,
      "A beautiful sunset over mountains",
      {
        aspectRatio: "16:9",
        imageSize: "2K"
      }
    );
    
    console.log(`Google API returned ${googleResult.images.length} images`);
    
    // 使用云雾AI代理
    console.log('Using YunWu Proxy API...');
    const yunwuResult = await generateImageWithAutoDetect(
      yunwuApiKey,
      "A beautiful sunset over mountains",
      {
        aspectRatio: "16:9", 
        imageSize: "2K"
      }
    );
    
    console.log(`YunWu API returned ${yunwuResult.images.length} images`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * 示例2: 手动创建适配器并使用
 */
export async function exampleManualAdapter() {
  const apiKey = "sk-gVSCvIvRZRqsuNupuGS3BBGieIC8XyHLMVXv51sRbNZs9TfF"; // 你的API Key
  
  // 检测API类型
  const provider = detectApiProvider(apiKey);
  console.log(`Detected provider: ${provider}`);
  
  // 创建适配器
  const adapter = createGeminiAdapter(apiKey, {
    timeout: 120000, // 2分钟超时
  });
  
  // 生成图片
  const result = await adapter.generateImage({
    prompt: "Create a professional presentation slide background with abstract geometric patterns",
    aspectRatio: "16:9",
    imageSize: "2K"
  });
  
  if (result.error) {
    console.error('Generation failed:', result.error);
  } else {
    console.log(`Generated ${result.images.length} images`);
    // 处理生成的图片
    result.images.forEach((img, index) => {
      console.log(`Image ${index + 1}: ${img.mimeType}, size: ${img.data.length} chars`);
    });
  }
}

/**
 * 示例3: 带参考图片的生成（适用于编辑现有图片）
 */
export async function exampleWithReferenceImages() {
  const apiKey = "your-api-key"; // 替换为你的API Key
  
  // 假设你有一个base64编码的参考图片
  const refImageBase64 = "iVBORw0KGgoAAAANSUhEUgAA..."; // 你的base64图片数据
  
  const adapter = createGeminiAdapter(apiKey);
  
  const result = await adapter.generateImage({
    prompt: "Based on the reference image, create a similar style but with different colors",
    aspectRatio: "16:9",
    imageSize: "2K",
    refImages: [{
      data: refImageBase64,
      mimeType: "image/png"
    }]
  });
  
  return result;
}

/**
 * 示例4: 在现有项目API路由中集成
 */
export async function integrateWithExistingAPI(
  apiKey: string,
  prompt: string,
  aspectRatio: string = "16:9",
  assetUrls?: string[]
) {
  try {
    // 处理资产URL（如果有的话，需要转换为base64）
    const refImages = [];
    if (assetUrls) {
      for (const url of assetUrls) {
        try {
          // 获取图片并转换为base64
          const response = await fetch(url);
          const blob = await response.blob();
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
    
    // 使用适配器生成图片
    const result = await generateImageWithAutoDetect(apiKey, prompt, {
      aspectRatio,
      imageSize: "2K",
      refImages: refImages.length > 0 ? refImages : undefined
    });
    
    if (result.error) {
      throw new Error(`Image generation failed: ${result.error}`);
    }
    
    return result.images[0]; // 返回第一张图片
    
  } catch (error) {
    console.error('Integration error:', error);
    throw error;
  }
}

/**
 * 工具函数: Blob转Base64
 */
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

/**
 * 示例5: 错误处理和重试
 */
export async function exampleWithRetry(apiKey: string, prompt: string, maxRetries: number = 3) {
  const adapter = createGeminiAdapter(apiKey);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`);
      
      const result = await adapter.generateImage({
        prompt,
        aspectRatio: "16:9",
        imageSize: "2K"
      });
      
      if (!result.error && result.images.length > 0) {
        console.log(`Success on attempt ${attempt}`);
        return result;
      }
      
      throw new Error(result.error || 'No images generated');
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/**
 * 示例6: 批量生成（适用于生成多张幻灯片）
 */
export async function exampleBatchGeneration(
  apiKey: string, 
  prompts: string[],
  concurrency: number = 3
) {
  const adapter = createGeminiAdapter(apiKey);
  const results = [];
  
  // 分批处理，避免并发过多
  for (let i = 0; i < prompts.length; i += concurrency) {
    const batch = prompts.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (prompt, index) => {
      try {
        console.log(`Generating slide ${i + index + 1}/${prompts.length}`);
        
        const result = await adapter.generateImage({
          prompt,
          aspectRatio: "16:9", 
          imageSize: "2K"
        });
        
        return {
          index: i + index,
          success: true,
          result
        };
      } catch (error) {
        return {
          index: i + index,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 批次间间隔，避免API限制
    if (i + concurrency < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}