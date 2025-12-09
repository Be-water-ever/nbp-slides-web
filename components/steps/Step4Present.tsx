"use client";

import { useState, useCallback } from "react";
import { AppState } from "@/app/page";
import { 
  ArrowLeftIcon, 
  PlayIcon, 
  DownloadIcon,
  RefreshIcon,
  XIcon
} from "@/components/icons";

interface Step4PresentProps {
  appState: AppState;
  onPrev: () => void;
  onRestart: () => void;
}

export default function Step4Present({ 
  appState, 
  onPrev, 
  onRestart 
}: Step4PresentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const slides = appState.generatedSlides;
  const currentSlide = slides[currentSlideIndex];

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setCurrentSlideIndex(0);
    // Request browser fullscreen
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

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "Escape") {
      exitFullscreen();
    }
  }, [nextSlide, prevSlide, exitFullscreen]);

  const downloadSlide = useCallback((slide: { number: number; path: string; enlarged?: string }) => {
    const url = slide.enlarged || slide.path;
    const link = document.createElement("a");
    link.href = url;
    link.download = `slide_${slide.number}${slide.enlarged ? "_4k" : ""}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const downloadAll = useCallback(async () => {
    // Download all slides sequentially
    for (const slide of slides) {
      downloadSlide(slide);
      // Small delay to prevent browser blocking
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }, [slides, downloadSlide]);

  // Fullscreen presentation mode
  if (isFullscreen) {
    return (
      <div 
        className="fixed inset-0 bg-black z-50 flex items-center justify-center"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        autoFocus
      >
        {/* Slide display */}
        {currentSlide && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={currentSlide.enlarged || currentSlide.path}
            alt={`Slide ${currentSlide.number}`}
            className="max-w-full max-h-full object-contain"
          />
        )}

        {/* Navigation overlay */}
        <div className="absolute inset-0 flex">
          {/* Left click zone */}
          <div 
            className="w-1/3 h-full cursor-pointer"
            onClick={prevSlide}
          />
          {/* Center - show controls on hover */}
          <div className="w-1/3 h-full" />
          {/* Right click zone */}
          <div 
            className="w-1/3 h-full cursor-pointer"
            onClick={nextSlide}
          />
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-white/80 text-sm">
            {currentSlideIndex + 1} / {slides.length}
          </span>
          <button
            onClick={exitFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <XIcon className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-white/50 transition-all duration-300"
            style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
          />
        </div>

        {/* Keyboard hints */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs opacity-0 hover:opacity-100 transition-opacity">
          ← → 或 空格键翻页 · ESC 退出
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">展示你的幻灯片</h2>
        <p className="text-white/60">
          全屏演示或下载你生成的幻灯片
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6">
        {/* Preview Panel */}
        <div className="flex-1 flex flex-col">
          {/* Current slide preview */}
          <div className="flex-1 bg-black rounded-xl overflow-hidden relative">
            {currentSlide && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentSlide.enlarged || currentSlide.path}
                alt={`Slide ${currentSlide.number}`}
                className="w-full h-full object-contain"
              />
            )}
            
            {/* Slide info overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <span className="bg-black/50 px-3 py-1.5 rounded-lg text-sm">
                第 {currentSlideIndex + 1} 页 / 共 {slides.length} 页
                {currentSlide?.enlarged && (
                  <span className="ml-2 text-green-400">4K</span>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => currentSlide && downloadSlide(currentSlide)}
                  className="bg-black/50 p-2 rounded-lg hover:bg-black/70 transition-colors"
                  title="下载当前页"
                >
                  <DownloadIcon className="w-5 h-5" />
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
                  flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden
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
            <div className="space-y-2">
              <button
                onClick={() => currentSlide && downloadSlide(currentSlide)}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                下载当前页
              </button>
              <button
                onClick={downloadAll}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                下载全部 ({slides.length})
              </button>
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

