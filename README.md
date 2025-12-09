# NBP Slides Web

AI 驱动的幻灯片生成器 - 使用 Gemini API 生成专业级幻灯片。

## 功能特性

- **4 步向导式工作流**
  1. 配置 API Key 和编辑大纲
  2. 生成预览图
  3. 选择性放大（可选）
  4. 全屏演示和下载

- **安全设计**: 用户的 API Key 仅用于调用 Gemini API，不会被存储
- **云端部署**: 支持 Vercel + Railway 部署架构

## 部署指南

### 前置条件

- [Vercel](https://vercel.com) 账号
- [Railway](https://railway.app) 账号
- [Cloudflare](https://cloudflare.com) 账号（用于 R2 存储）
- [GitHub](https://github.com) 账号

### 步骤 1: 创建 Cloudflare R2 存储桶

1. 登录 Cloudflare Dashboard
2. 进入 R2 Object Storage
3. 创建存储桶 `nbp-slides-assets`
4. 创建 API Token（Object Read & Write 权限）
5. 记录 Account ID、Access Key ID、Secret Access Key

### 步骤 2: 部署 Python 后端到 Railway

1. Fork 或上传 `nbp_slides_api` 项目到 GitHub
2. 在 Railway 创建新项目，连接 GitHub 仓库
3. 配置环境变量：
   ```
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=nbp-slides-assets
   R2_PUBLIC_URL=https://your-bucket.r2.dev
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```
4. 部署完成后，记录 Railway 提供的 URL（如 `https://xxx.railway.app`）

### 步骤 3: 部署前端到 Vercel

1. 在 Vercel 导入此项目
2. 配置环境变量：
   ```
   R2_ACCOUNT_ID=xxx
   R2_ACCESS_KEY_ID=xxx
   R2_SECRET_ACCESS_KEY=xxx
   R2_BUCKET_NAME=nbp-slides-assets
   R2_PUBLIC_URL=https://your-bucket.r2.dev
   API_URL=https://xxx.railway.app
   NEXT_PUBLIC_API_URL=https://xxx.railway.app
   ```
3. 部署

## 本地开发

```bash
# 安装依赖
npm install

# 创建环境变量文件
cp env.example .env.local
# 编辑 .env.local 填入你的配置

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
nbp_slides_web/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── generate/      # 生成幻灯片
│   │   ├── enlarge/       # 放大图片
│   │   ├── upload/        # 上传到 R2
│   │   └── status/        # 查询任务状态
│   └── page.tsx           # 主页面
├── components/            # React 组件
│   └── steps/            # 4 步向导组件
├── lib/                   # 工具函数
└── public/               # 静态资源
```

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS
- **后端**: FastAPI (Python)
- **存储**: Cloudflare R2
- **AI**: Google Gemini API
- **部署**: Vercel + Railway

## 许可证

MIT
