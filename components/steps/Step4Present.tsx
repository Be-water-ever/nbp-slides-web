"use client";

import { useState, useCallback, useRef } from "react";
import { AppState, TextBlock, GeneratedSlide } from "@/app/page";
import { 
  ArrowLeftIcon, 
  PlayIcon, 
  DownloadIcon,
  RefreshIcon,
  XIcon,
  EditIcon,
  LoadingSpinner
} from "@/components/icons";
import {
  downloadSlideAsPNG,
  downloadAllSlidesAsPNG,
  downloadSlidesAsPDF,
  downloadSlidesAsPPTX,
} from "@/lib/export-utils";

interface Step4PresentProps {
  appState: AppState;
  onPrev: () => void;
  onRestart: () => void;
}

type DownloadFormat = "png" | "pdf" | "pptx";

// Helper to get font size from OCR size label
function getFontSize(size: string): string {
  switch (size) {
    case "large": return "4vw";
    case "medium": return "2.5vw";
    case "small": return "1.8vw";
    case "tiny": return "1.2vw";
    default: return "2vw";
  }
}

// Get the best image URL for a slide (clean > enlarged > original)
function getDisplayUrl(slide: GeneratedSlide, preferClean: boolean = true): string {
  if (preferClean && slide.cleanPath) {
    return slide.cleanPath;
  }
  return slide.enlarged || slide.path;
}

// Editable text block component
function EditableTextBlock({ 
  block, 
  onUpdate,
  isEditing,
  onClick,
}: { 
  block: TextBlock; 
  onUpdate: (content: string) => void;
  isEditing: boolean;
  onClick: () => void;
}) {
  const textRef = useRef<HTMLDivElement>(null);

  const handleBlur = () => {
    if (textRef.current) {
      onUpdate(textRef.current.innerText);
    }
  };

  return (
    <div
      ref={textRef}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={onClick}
      onBlur={handleBlur}
      className={`absolute transition-all duration-200 ${
        isEditing 
          ? "outline outline-2 outline-accent-blue bg-black/20 rounded px-2" 
          : "cursor-pointer hover:outline hover:outline-1 hover:outline-white/30"
      }`}
      style={{
        left: `${block.x_percent}%`,
        top: `${block.y_percent}%`,
        width: `${block.width_percent}%`,
        transform: "translate(-50%, -50%)",
        fontSize: getFontSize(block.size),
        color: block.color || "#333333",
        textAlign: block.align as "left" | "center" | "right" || "center",
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        fontWeight: block.size === "large" ? 600 : 400,
        lineHeight: 1.3,
        textShadow: "0 1px 3px rgba(0,0,0,0.1)",
        whiteSpace: "pre-wrap",
      }}
    >
      {block.content}
    </div>
  );
}

export default function Step4Present({ 
  appState, 
  onPrev, 
  onRestart 
}: Step4PresentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [editMode, setEditMode] = useState(true);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [localSlides, setLocalSlides] = useState(appState.generatedSlides);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<DownloadFormat>("png");

  const slides = localSlides;
  const currentSlide = slides[currentSlideIndex];
  
  // Check if current slide has editable text (cleanPath means text was extracted)
  const hasEditableText = currentSlide?.cleanPath && currentSlide?.textBlocks && currentSlide.textBlocks.length > 0;

  // Update text block content
  const updateTextBlock = useCallback((slideIndex: number, blockIndex: number, content: string) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[slideIndex] };
      const textBlocks = [...(slide.textBlocks || [])];
      textBlocks[blockIndex] = { ...textBlocks[blockIndex], content };
      slide.textBlocks = textBlocks;
      newSlides[slideIndex] = slide;
      return newSlides;
    });
  }, []);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setCurrentSlideIndex(0);
    document.documentElement.requestFullscreen?.();
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    document.exitFullscreen?.();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "Escape") {
      exitFullscreen();
    }
  }, [nextSlide, prevSlide, exitFullscreen]);

  // Download current slide with selected format
  const downloadCurrentSlide = useCallback(async () => {
    if (!currentSlide) return;
    
    setIsExporting(true);
    try {
      if (exportFormat === "png") {
        await downloadSlideAsPNG(currentSlide, currentSlide.number);
      } else if (exportFormat === "pdf") {
        await downloadSlidesAsPDF([currentSlide]);
      } else if (exportFormat === "pptx") {
        await downloadSlidesAsPPTX([currentSlide]);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("下载失败，请重试");
    } finally {
      setIsExporting(false);
    }
  }, [currentSlide, exportFormat]);

  // Download all slides with selected format
  const downloadAllSlides = useCallback(async () => {
    setIsExporting(true);
    try {
      if (exportFormat === "png") {
        await downloadAllSlidesAsPNG(slides);
      } else if (exportFormat === "pdf") {
        await downloadSlidesAsPDF(slides);
      } else if (exportFormat === "pptx") {
        await downloadSlidesAsPPTX(slides);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("下载失败，请重试");
    } finally {
      setIsExporting(false);
    }
  }, [slides, exportFormat]);

  // Export as HTML with editable text overlay (uses clean images where available)
  const exportAsHTML = useCallback(() => {
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NBP Slides Presentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/theme/white.css">
  <style>
    .slide-container { position: relative; width: 100%; height: 100%; }
    .slide-bg { width: 100%; height: 100%; object-fit: contain; }
    .text-block {
      position: absolute;
      transform: translate(-50%, -50%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.3;
      white-space: pre-wrap;
    }
    .text-block[contenteditable]:focus {
      outline: 2px solid #4F8FF7;
      background: rgba(0,0,0,0.1);
      border-radius: 4px;
      padding: 4px 8px;
    }
    .text-large { font-size: 4vw; font-weight: 600; }
    .text-medium { font-size: 2.5vw; font-weight: 400; }
    .text-small { font-size: 1.8vw; font-weight: 400; }
    .text-tiny { font-size: 1.2vw; font-weight: 400; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slides.map((slide, index) => {
  const imageUrl = slide.cleanPath || slide.enlarged || slide.path;
  const hasText = slide.cleanPath && slide.textBlocks && slide.textBlocks.length > 0;
  
  return `
      <section>
        <div class="slide-container">
          <img class="slide-bg" src="${imageUrl}" alt="Slide ${index + 1}">
${hasText ? (slide.textBlocks || []).map(block => `
          <div class="text-block text-${block.size}" contenteditable="true"
               style="left:${block.x_percent}%;top:${block.y_percent}%;width:${block.width_percent}%;color:${block.color};text-align:${block.align};">
            ${block.content}
          </div>
`).join('') : ''}
        </div>
      </section>
`;
}).join('')}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      hash: true,
      controls: true,
      progress: true,
      center: false,
      width: 1920,
      height: 1080,
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "presentation.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [slides]);

  // Fullscreen presentation mode
  if (isFullscreen) {
    const fullscreenSlide = slides[currentSlideIndex];
    const fullscreenHasText = fullscreenSlide?.cleanPath && fullscreenSlide?.textBlocks && fullscreenSlide.textBlocks.length > 0;
    
    return (
      <div 
        className="fixed inset-0 bg-black z-50 flex items-center justify-center"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        autoFocus
      >
        {fullscreenSlide && (
          <div className="relative max-w-full max-h-full" style={{ aspectRatio: "16/9" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDisplayUrl(fullscreenSlide, true)}
              alt={`Slide ${fullscreenSlide.number}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {fullscreenHasText && (
              <div className="absolute inset-0">
                {fullscreenSlide.textBlocks!.map((block, idx) => (
                  <div
                    key={idx}
                    className="absolute"
                    style={{
                      left: `${block.x_percent}%`,
                      top: `${block.y_percent}%`,
                      width: `${block.width_percent}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: getFontSize(block.size),
                      color: block.color || "#333333",
                      textAlign: block.align as "left" | "center" | "right" || "center",
                      fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                      fontWeight: block.size === "large" ? 600 : 400,
                      lineHeight: 1.3,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {block.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-0 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={prevSlide} />
          <div className="w-1/3 h-full" />
          <div className="w-1/3 h-full cursor-pointer" onClick={nextSlide} />
        </div>

        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-white/80 text-sm">
            {currentSlideIndex + 1} / {slides.length}
            {fullscreenHasText && <span className="ml-2 text-purple-400">可编辑</span>}
          </span>
          <button
            onClick={exitFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <XIcon className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-white/50 transition-all duration-300"
            style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
          />
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs opacity-0 hover:opacity-100 transition-opacity">
          ← → 或 空格键翻页 · ESC 退出
        </div>
      </div>
    );
  }

  const editableCount = slides.filter(s => s.cleanPath).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">展示并编辑幻灯片</h2>
        <p className="text-white/60">
          {hasEditableText 
            ? "点击幻灯片上的文字可直接编辑 · 全屏演示或下载"
            : "全屏演示或下载 · 返回第 3 步提取可编辑文字"
          }
        </p>
        {hasEditableText && (
          <p className="text-purple-400 text-sm mt-1 flex items-center gap-1">
            <EditIcon className="w-4 h-4" />
            此页已提取 {currentSlide.textBlocks!.length} 个可编辑文字块（背景已清除原文字）
          </p>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6">
        {/* Preview Panel */}
        <div className="flex-1 flex flex-col">
          {/* Current slide preview with editable text */}
          <div className="flex-1 bg-black rounded-xl overflow-hidden relative">
            {currentSlide && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getDisplayUrl(currentSlide, editMode)}
                  alt={`Slide ${currentSlide.number}`}
                  className="w-full h-full object-contain"
                />
                
                {editMode && hasEditableText && (
                  <div className="absolute inset-0 pointer-events-auto">
                    {currentSlide.textBlocks!.map((block, blockIndex) => (
                      <EditableTextBlock
                        key={blockIndex}
                        block={block}
                        isEditing={editingBlockIndex === blockIndex}
                        onClick={() => setEditingBlockIndex(blockIndex)}
                        onUpdate={(content) => {
                          updateTextBlock(currentSlideIndex, blockIndex, content);
                          setEditingBlockIndex(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
              <span className="bg-black/50 px-3 py-1.5 rounded-lg text-sm">
                第 {currentSlideIndex + 1} 页 / 共 {slides.length} 页
                {currentSlide?.enlarged && (
                  <span className="ml-2 text-green-400">4K</span>
                )}
                {hasEditableText && (
                  <span className="ml-2 text-purple-400">可编辑</span>
                )}
              </span>
              <div className="flex gap-2">
                {hasEditableText && (
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      editMode 
                        ? "bg-purple-500 text-white" 
                        : "bg-black/50 hover:bg-black/70"
                    }`}
                    title={editMode ? "显示原图" : "显示可编辑版本"}
                  >
                    {editMode ? "编辑中" : "编辑文字"}
                  </button>
                )}
                <button
                  onClick={downloadCurrentSlide}
                  disabled={isExporting}
                  className="bg-black/50 p-2 rounded-lg hover:bg-black/70 transition-colors"
                  title="下载当前页"
                >
                  {isExporting ? (
                    <LoadingSpinner className="w-5 h-5" />
                  ) : (
                    <DownloadIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.number}
                onClick={() => setCurrentSlideIndex(index)}
                className={`
                  flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden relative
                  transition-all duration-200
                  ${index === currentSlideIndex 
                    ? "ring-2 ring-accent-blue" 
                    : "opacity-60 hover:opacity-100"
                  }
                `}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.path}
                  alt={`Thumbnail ${slide.number}`}
                  className="w-full h-full object-cover"
                />
                {slide.cleanPath && (
                  <span className="absolute top-1 right-1 bg-purple-500 rounded p-0.5">
                    <EditIcon className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Panel */}
        <div className="w-64 flex flex-col gap-4">
          {/* Present button */}
          <button
            onClick={enterFullscreen}
            className="btn-primary flex items-center justify-center gap-2 py-4"
          >
            <PlayIcon className="w-6 h-6" />
            全屏演示
          </button>

          {/* Download options */}
          <div className="glass-panel p-4">
            <h3 className="font-medium mb-3">下载</h3>
            
            {/* Format selector */}
            <div className="mb-3">
              <label className="text-xs text-white/60 mb-1 block">选择格式</label>
              <div className="flex gap-1">
                {(["png", "pdf", "pptx"] as DownloadFormat[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded transition-colors ${
                      exportFormat === format
                        ? "bg-accent-blue text-white"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-1">
                {exportFormat === "png" && "合成图片（含编辑后文字）"}
                {exportFormat === "pdf" && "文字可选中/复制"}
                {exportFormat === "pptx" && "文字可编辑"}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={downloadCurrentSlide}
                disabled={isExporting}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <LoadingSpinner className="w-4 h-4" />
                ) : (
                  <DownloadIcon className="w-4 h-4" />
                )}
                下载当前页 (.{exportFormat})
              </button>
              <button
                onClick={downloadAllSlides}
                disabled={isExporting}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <LoadingSpinner className="w-4 h-4" />
                ) : (
                  <DownloadIcon className="w-4 h-4" />
                )}
                下载全部 (.{exportFormat})
              </button>
              
              {/* HTML Export - always available */}
              <div className="border-t border-white/10 pt-2 mt-2">
                <button
                  onClick={exportAsHTML}
                  className="w-full btn-primary text-sm py-2 flex items-center justify-center gap-2"
                  title="导出为可编辑的 HTML 演示文件"
                >
                  <DownloadIcon className="w-4 h-4" />
                  导出 HTML (可编辑)
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="glass-panel p-4">
            <h3 className="font-medium mb-3">统计</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">总页数</span>
                <span>{slides.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">4K 页数</span>
                <span className="text-green-400">
                  {slides.filter((s) => s.enlarged).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">可编辑页数</span>
                <span className="text-purple-400">
                  {editableCount}
                </span>
              </div>
            </div>
          </div>

          {/* Restart */}
          <button
            onClick={onRestart}
            className="mt-auto text-white/50 hover:text-white text-sm flex items-center justify-center gap-2"
          >
            <RefreshIcon className="w-4 h-4" />
            创建新的幻灯片
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
        <button
          onClick={onPrev}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          返回优化
        </button>

        <button
          onClick={enterFullscreen}
          className="btn-primary flex items-center gap-2"
        >
          <PlayIcon className="w-5 h-5" />
          开始演示
        </button>
      </div>
    </div>
  );
}
