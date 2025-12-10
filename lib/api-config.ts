/**
 * API配置文件
 * 管理不同API Provider的配置选项
 */

import { ApiProvider } from './gemini-adapter';

export interface ApiConfig {
  // 是否强制使用后端代理（即使是支持直接调用的API）
  forceBackendProxy: boolean;
  
  // 是否启用API自动切换
  enableAutoSwitch: boolean;
  
  // 默认的图片生成参数
  defaultImageParams: {
    aspectRatio: string;
    imageSize: string;
    timeout: number;
  };
  
  // 各个Provider的特定配置
  providerConfigs: {
    [ApiProvider.GOOGLE_OFFICIAL]: {
      useBackendProxy: boolean;
      model: string;
      maxRetries: number;
    };
    [ApiProvider.YUNWU_PROXY]: {
      useBackendProxy: boolean;
      model: string;
      maxRetries: number;
      directCallEnabled: boolean;
    };
  };
}

// 默认配置
export const DEFAULT_API_CONFIG: ApiConfig = {
  forceBackendProxy: false,
  enableAutoSwitch: true,
  
  defaultImageParams: {
    aspectRatio: "16:9",
    imageSize: "2K",
    timeout: 120000, // 2分钟
  },
  
  providerConfigs: {
    [ApiProvider.GOOGLE_OFFICIAL]: {
      useBackendProxy: true, // Google API通常需要后端代理处理特定配置
      model: "gemini-pro-vision",
      maxRetries: 3,
    },
    [ApiProvider.YUNWU_PROXY]: {
      useBackendProxy: false, // 云雾AI可以直接调用
      model: "gemini-3-pro-image-preview",
      maxRetries: 3,
      directCallEnabled: true,
    },
  },
};

// 从环境变量读取配置
export function getApiConfigFromEnv(): Partial<ApiConfig> {
  return {
    forceBackendProxy: process.env.FORCE_BACKEND_PROXY === 'true',
    enableAutoSwitch: process.env.ENABLE_AUTO_SWITCH !== 'false', // 默认启用
    
    defaultImageParams: {
      aspectRatio: process.env.DEFAULT_ASPECT_RATIO || "16:9",
      imageSize: process.env.DEFAULT_IMAGE_SIZE || "2K", 
      timeout: parseInt(process.env.API_TIMEOUT || "120000"),
    },
  };
}

// 合并默认配置和环境变量配置
export function getApiConfig(): ApiConfig {
  const envConfig = getApiConfigFromEnv();
  return {
    ...DEFAULT_API_CONFIG,
    ...envConfig,
    defaultImageParams: {
      ...DEFAULT_API_CONFIG.defaultImageParams,
      ...envConfig.defaultImageParams,
    },
  };
}

/**
 * 根据API密钥和配置决定调用策略
 */
export function getCallStrategy(apiKey: string, config: ApiConfig = getApiConfig()): {
  provider: ApiProvider;
  useBackendProxy: boolean;
  model: string;
  maxRetries: number;
} {
  // 检测API Provider
  let provider: ApiProvider;
  if (apiKey.startsWith('AIza')) {
    provider = ApiProvider.GOOGLE_OFFICIAL;
  } else if (apiKey.startsWith('sk-')) {
    provider = ApiProvider.YUNWU_PROXY;
  } else {
    throw new Error('Unsupported API key format');
  }
  
  const providerConfig = config.providerConfigs[provider];
  
  return {
    provider,
    useBackendProxy: config.forceBackendProxy || providerConfig.useBackendProxy,
    model: providerConfig.model,
    maxRetries: providerConfig.maxRetries,
  };
}

/**
 * 验证API密钥格式
 */
export function validateApiKey(apiKey: string): { valid: boolean; provider?: ApiProvider; error?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required' };
  }
  
  if (apiKey.length < 20) {
    return { valid: false, error: 'API key too short' };
  }
  
  try {
    if (apiKey.startsWith('AIza')) {
      return { valid: true, provider: ApiProvider.GOOGLE_OFFICIAL };
    } else if (apiKey.startsWith('sk-')) {
      return { valid: true, provider: ApiProvider.YUNWU_PROXY };
    } else {
      return { 
        valid: false, 
        error: 'Unsupported API key format. Expected AIza* (Google) or sk-* (YunWu)' 
      };
    }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error' 
    };
  }
}

/**
 * 获取友好的Provider名称
 */
export function getProviderDisplayName(provider: ApiProvider): string {
  switch (provider) {
    case ApiProvider.GOOGLE_OFFICIAL:
      return 'Google Gemini (官方)';
    case ApiProvider.YUNWU_PROXY:
      return '云雾AI (代理)';
    default:
      return 'Unknown Provider';
  }
}