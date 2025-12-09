# NBP Slides Web

基于 Next.js 的 Web 界面，让用户通过浏览器使用 Nano Banana Pro (Gemini) 生成幻灯片。

## 功能特性

- **4 步向导式工作流**
  1. 配置 API Key 和编辑大纲
  2. 生成 1K 预览图
  3. 选择性放大到 4K
  4. 全屏演示和下载

- **安全设计**: 用户的 API Key 仅在内存中使用，不会被存储
- **实时进度**: 显示生成进度和缩略图预览
- **玻璃拟态 UI**: 遵循 "Glass Garden" 设计语言

## 快速开始

### 前置条件

- Node.js 18+
- Python 3.8+ (用于调用原有的生成脚本)
- 原有的 `nbp_slides` 项目 (包含 Python 脚本)

### 安装

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env.local
```

### 配置

编辑 `.env.local` 确保路径指向原有的 `nbp_slides` 项目:

```env
PYTHON_SCRIPTS_PATH=../nbp_slides/tools
NBP_SLIDES_PATH=../nbp_slides
```

### 运行

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

访问 http://localhost:3000 开始使用。

## 项目结构

```
nbp_slides_web/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── generate/      # 生成幻灯片
│   │   ├── enlarge/       # 放大到 4K
│   │   └── status/        # 查询任务状态
│   ├── layout.tsx         # 全局布局
│   ├── page.tsx           # 主页面
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── Stepper.tsx       # 步骤导航
│   ├── icons.tsx         # 图标组件
│   └── steps/            # 4 步向导组件
├── lib/                   # 工具函数
│   ├── python-bridge.ts  # 调用 Python 脚本
│   ├── job-store.ts      # 任务状态管理
│   └── parse-outline.ts  # 解析大纲
└── public/generated/      # 生成的幻灯片
```

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS
- **后端**: Next.js API Routes
- **AI**: Gemini 3 Pro (通过现有 Python 脚本调用)

## 工作原理

1. 用户在前端输入 API Key 和大纲
2. 前端调用 `/api/generate` 开始生成任务
3. API Route 使用用户的 API Key 作为环境变量调用 Python 脚本
4. Python 脚本调用 Gemini API 生成图片
5. 前端轮询 `/api/status/[jobId]` 获取进度
6. 生成完成后显示预览，可选择放大或直接展示

## 许可证

MIT

