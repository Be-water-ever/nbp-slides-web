# Gemini API 集成指南

本项目现在支持两种 Gemini API 提供商：

## 支持的 API 类型

### 1. Google 官方 API
- **密钥格式**: `AIza...`
- **获取方式**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **调用方式**: 通过后端代理调用（保持原有架构）
- **模型**: `gemini-pro-vision`

### 2. 云雾AI代理
- **密钥格式**: `sk-...`
- **获取方式**: 云雾AI平台
- **调用方式**: 可直接调用或通过后端代理
- **模型**: `gemini-3-pro-image-preview`

## 新增功能

### 自动 API 检测
系统会根据密钥格式自动检测 API 类型：
- 在 Step1Config 组件中显示检测结果
- 绿点表示有效密钥，红点表示无效密钥
- 显示使用的 API 提供商名称

### 智能路由
- **Google API**: 继续使用后端代理，确保稳定性
- **云雾AI**: 默认直接调用，出错时自动回退到后端代理

### 配置选项
通过环境变量控制行为：

```env
# 强制所有API都使用后端代理
FORCE_BACKEND_PROXY=true

# 禁用自动切换（默认启用）
ENABLE_AUTO_SWITCH=false

# 默认图片参数
DEFAULT_ASPECT_RATIO=16:9
DEFAULT_IMAGE_SIZE=2K
API_TIMEOUT=120000
```

## 文件结构

### 新增文件
```
lib/
├── gemini-adapter.ts        # 统一的API适配器
├── api-config.ts           # API配置管理
└── gemini-usage-example.ts # 使用示例（可删除）

docs/
└── API_INTEGRATION_GUIDE.md # 本文档
```

### 修改的文件
```
components/steps/Step1Config.tsx     # 添加API类型显示
app/api/generate-single/route.ts    # 支持双API路由
```

## 使用方式

### 前端组件
```typescript
import { validateApiKey, getProviderDisplayName } from "@/lib/api-config";

// 验证API密钥
const validation = validateApiKey(apiKey);
if (validation.valid) {
  console.log(`使用: ${getProviderDisplayName(validation.provider!)}`);
}
```

### API路由
```typescript
import { generateImageWithAutoDetect } from "@/lib/gemini-adapter";

// 自动检测并调用合适的API
const result = await generateImageWithAutoDetect(apiKey, prompt, {
  aspectRatio: "16:9",
  imageSize: "2K"
});
```

### 手动创建适配器
```typescript
import { createGeminiAdapter, ApiProvider } from "@/lib/gemini-adapter";

const adapter = createGeminiAdapter(apiKey, {
  timeout: 120000,
  model: "custom-model"  // 可选择自定义模型
});

const result = await adapter.generateImage({
  prompt: "your prompt",
  aspectRatio: "16:9"
});
```

## 错误处理

### 自动回退机制
1. 首先尝试检测API类型并使用对应的调用方式
2. 如果直接调用失败，自动回退到后端代理
3. 如果后端代理也失败，返回详细错误信息

### 错误信息
- `API key not valid`: 密钥格式错误或无效
- `Unsupported API key format`: 不支持的密钥格式
- `Generation failed`: 图片生成失败
- 具体的HTTP错误码和消息

## 注意事项

### 云雾AI直接调用的限制
1. 需要实现 `uploadBase64Image` 函数来处理生成的图片存储
2. 目前使用占位符实现，生产环境需要连接真实存储服务

### 后端兼容性
如果你的 Python 后端不支持 sk- 密钥，需要：
1. 设置 `FORCE_BACKEND_PROXY=false`
2. 或者更新后端代码支持云雾AI API

### 性能优化
- 云雾AI直接调用可以减少网络延迟
- Google API通过后端调用确保稳定性
- 系统会根据API类型自动选择最优路径

## 测试

### 测试不同API
1. 使用 Google API Key (AIza...) 测试官方API
2. 使用云雾AI Key (sk-...) 测试代理API
3. 验证自动检测和路由功能

### 错误测试
1. 使用无效密钥测试错误处理
2. 测试网络错误时的回退机制
3. 验证超时处理

## 迁移指南

### 从单一API迁移
如果你之前只使用Google API：
1. 无需修改现有代码
2. 新功能会自动生效
3. 可以开始使用云雾AI密钥

### 环境变量配置
添加到 `.env.local` 或部署环境：
```env
# 可选配置
FORCE_BACKEND_PROXY=false
ENABLE_AUTO_SWITCH=true
DEFAULT_ASPECT_RATIO=16:9
DEFAULT_IMAGE_SIZE=2K
```

这样你就可以同时支持两种API，用户可以根据需要选择使用哪种密钥！