# 部署指南

## 🚀 线上环境配置

### 1. Vercel/Netlify 环境变量设置

在部署平台设置以下环境变量：

```env
# 生产环境标识
NODE_ENV=production

# Cloudflare R2 存储配置（必需）
R2_ACCOUNT_ID=你的真实账户ID
R2_ACCESS_KEY_ID=你的真实访问密钥
R2_SECRET_ACCESS_KEY=你的真实秘密密钥
R2_BUCKET_NAME=你的真实桶名称
R2_PUBLIC_URL=https://你的自定义域名.com

# Python 后端服务配置
API_URL=https://你的后端服务.railway.app
NEXT_PUBLIC_API_URL=https://你的后端服务.railway.app

# API 行为配置
FORCE_BACKEND_PROXY=false
ENABLE_AUTO_SWITCH=true
DEFAULT_ASPECT_RATIO=16:9
DEFAULT_IMAGE_SIZE=2K
API_TIMEOUT=120000
```

### 2. 环境隔离策略

系统会根据以下规则自动选择存储方案：

#### 开发环境 (NODE_ENV=development)
- ✅ **始终使用 data URL 备用方案**
- ✅ **即使有 R2 配置也不会使用**
- ✅ **上传图片转换为 base64 data URI**
- ✅ **不会产生 SSL 连接错误**

#### 生产环境 (NODE_ENV=production)
- ✅ **强制检查 R2 配置有效性**
- ✅ **配置无效时直接报错，不会回退**
- ✅ **确保线上服务稳定性**
- ✅ **使用真实的 R2 存储服务**

### 3. 安全保护机制

#### 配置验证
```javascript
// 系统会检查配置是否为占位符
const hasValidR2Config = hasR2Config && 
  R2_ACCOUNT_ID !== 'your_account_id' &&
  R2_ACCESS_KEY_ID !== 'your_access_key_id' &&
  R2_SECRET_ACCESS_KEY !== 'your_secret_access_key';
```

#### 环境检查
```javascript
// 开发环境强制使用备用方案
if (isDevelopment || !hasValidR2Config) {
  return dataURL; // 备用方案
}

// 生产环境强制要求有效配置
if (isProduction && !hasValidR2Config) {
  throw new Error("Storage service not properly configured");
}
```

## 🔧 本地开发环境

### 当前配置 (.env.local)
```env
# 开发环境标识
NODE_ENV=development

# R2配置（即使填了占位符也不会使用）
R2_ACCOUNT_ID=your_account_id  # 占位符，不会被使用
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=nbp-slides-assets
```

### 工作原理
1. **NODE_ENV=development** 强制使用 data URL 方案
2. **占位符配置不会被使用**，避免 SSL 错误
3. **上传功能正常工作**，生成 base64 图片URL

## 📋 部署检查清单

### 部署前检查
- [ ] 确认线上环境变量已正确设置
- [ ] R2 配置使用真实值，不是占位符
- [ ] NODE_ENV=production 已设置
- [ ] API_URL 指向真实后端服务

### 部署后验证
- [ ] 上传功能正常（使用 R2 存储）
- [ ] 生成的图片URL可以正常访问
- [ ] 日志中没有 SSL 错误
- [ ] 没有"Using data URL"的警告日志

## 🆘 故障排查

### 常见问题

1. **生产环境出现"Storage service not properly configured"错误**
   - 检查 R2 环境变量是否正确设置
   - 确认配置值不是占位符

2. **开发环境出现 SSL 错误**
   - 确认 NODE_ENV=development 已设置
   - 重启开发服务器

3. **上传功能在开发环境不工作**
   - 检查 console 中的警告信息
   - 确认看到"Using data URL for development environment"

### 日志监控

开发环境正常日志：
```
Using data URL for development environment
```

生产环境正常日志：
```
Uploading to R2: assets/uuid.jpg
Upload successful: https://bucket.domain.com/assets/uuid.jpg
```

## 🔒 安全性保证

1. **环境隔离**：开发和生产环境使用不同的存储方案
2. **配置验证**：自动检测无效配置，防止错误部署
3. **回退机制**：开发环境即使配置错误也能正常工作
4. **错误处理**：生产环境配置错误时明确报错

这个方案确保了：
- ✅ **本地开发不需要真实 R2 配置**
- ✅ **线上服务不受影响**
- ✅ **配置错误时有明确提示**
- ✅ **不会意外使用错误的存储方案**