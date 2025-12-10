"use client";

import { useState, useCallback } from "react";
import { AppState, GeneratedSlide } from "@/app/page";
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  ExpandIcon,
  LoadingSpinner,
  CheckIcon,
  EditIcon
} from "@/components/icons";

interface Step3EnlargeProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step3Enlarge({ 
  appState, 
  updateState, 
  onNext, 
  onPrev 
}: Step3EnlargeProps) {
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
  const [processingSlides, setProcessingSlides] = useState<Set<number>>(new Set());
  const [processingType, setProcessingType] = useState<"enlarge" | "extract" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSlide = useCallback((slideNumber: number) => {
    setSelectedSlides((prev) => {
      const next = new Set(prev);
      if (next.has(slideNumber)) {
        next.delete(slideNumber);
      } else {
        next.add(slideNumber);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allNumbers = appState.generatedSlides.map((s) => s.number);
    setSelectedSlides(new Set(allNumbers));
  }, [appState.generatedSlides]);

  const selectNone = useCallback(() => {
    setSelectedSlides(new Set());
  }, []);

  // Enlarge a single slide to 4K
  const enlargeSlide = useCallback(async (slide: GeneratedSlide) => {
    setProcessingSlides((prev) => new Set(prev).add(slide.number));
    
    try {
      const response = await fetch("/api/enlarge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: appState.apiKey,
          imageUrl: slide.path,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Enlargement failed");
      }

      const { enlargedPath } = await response.json();

      updateState({
        generatedSlides: appState.generatedSlides.map((s) =>
          s.number === slide.number ? { ...s, enlarged: enlargedPath } : s
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessingSlides((prev) => {
        const next = new Set(prev);
        next.delete(slide.number);
        return next;
      });
    }
  }, [appState.apiKey, appState.generatedSlides, updateState]);

  // Extract text from a single slide (OCR + remove text from image)
  const extractTextFromSlide = useCallback(async (slide: GeneratedSlide) => {
    setProcessingSlides((prev) => new Set(prev).add(slide.number));
    
    try {
      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: appState.apiKey,
          imageUrl: slide.path,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Text extraction failed");
      }

      updateState({
        generatedSlides: appState.generatedSlides.map((s) =>
          s.number === slide.number 
            ? { 
                ...s, 
                cleanPath: result.clean_image_url,
                textBlocks: result.text_blocks || [],
              } 
            : s
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessingSlides((prev) => {
        const next = new Set(prev);
        next.delete(slide.number);
        return next;
      });
    }
  }, [appState.apiKey, appState.generatedSlides, updateState]);

  // Process all selected slides for enlargement
  const enlargeSelected = useCallback(async () => {
    setError(null);
    setProcessingType("enlarge");
    
    const slidesToProcess = appState.generatedSlides.filter(
      (s) => selectedSlides.has(s.number) && !s.enlarged
    );

    for (const slide of slidesToProcess) {
      await enlargeSlide(slide);
    }
    
    setProcessingType(null);
  }, [appState.generatedSlides, selectedSlides, enlargeSlide]);

  // Process all selected slides for text extraction
  const extractTextFromSelected = useCallback(async () => {
    setError(null);
    setProcessingType("extract");
    
    const slidesToProcess = appState.generatedSlides.filter(
      (s) => selectedSlides.has(s.number) && !s.cleanPath
    );

    for (const slide of slidesToProcess) {
      await extractTextFromSlide(slide);
    }
    
    setProcessingType(null);
  }, [appState.generatedSlides, selectedSlides, extractTextFromSlide]);

  const enlargedCount = appState.generatedSlides.filter((s) => s.enlarged).length;
  const extractedCount = appState.generatedSlides.filter((s) => s.cleanPath).length;
  const isProcessing = processingSlides.size > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">优化幻灯片 (可选)</h2>
        <p className="text-white/60">
          选择幻灯片进行 4K 放大 或 提取可编辑文字，也可以直接跳过进入展示
        </p>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex gap-3">
          <button
            onClick={selectAll}
            className="text-sm text-accent-blue hover:underline"
          >
            全选
          </button>
          <button
            onClick={selectNone}
            className="text-sm text-white/60 hover:text-white"
          >
            取消全选
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm text-white/60">
            已选 {selectedSlides.size} · 4K {enlargedCount} · 可编辑 {extractedCount}
          </span>
          
          {/* Enlarge Button */}
          <button
            onClick={enlargeSelected}
            disabled={selectedSlides.size === 0 || isProcessing}
            className="btn-secondary flex items-center gap-2"
          >
            {processingType === "enlarge" ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              <ExpandIcon className="w-4 h-4" />
            )}
            放大到 4K
          </button>
          
          {/* Extract Text Button */}
          <button
            onClick={extractTextFromSelected}
            disabled={selectedSlides.size === 0 || isProcessing}
            className="btn-primary flex items-center gap-2"
          >
            {processingType === "extract" ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              <EditIcon className="w-4 h-4" />
            )}
            提取可编辑文字
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-4 p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-xl">
        <p className="text-accent-blue text-sm">
          💡 <strong>提取可编辑文字</strong>：AI 会识别幻灯片上的文字位置，并生成一个干净的背景图。
          在第 4 步中，你可以直接编辑这些文字，导出时文字不会重叠。
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Slides Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {appState.generatedSlides.map((slide) => {
            const isSelected = selectedSlides.has(slide.number);
            const isProcessingThis = processingSlides.has(slide.number);
            const isEnlarged = !!slide.enlarged;
            const hasExtractedText = !!slide.cleanPath;

            return (
              <div
                key={slide.number}
                onClick={() => !isProcessingThis && toggleSlide(slide.number)}
                className={`
                  aspect-video rounded-xl overflow-hidden relative cursor-pointer
                  transition-all duration-200
                  ${isSelected ? "ring-2 ring-accent-blue ring-offset-2 ring-offset-background" : ""}
                `}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.enlarged || slide.path}
                  alt={`Slide ${slide.number}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay */}
                <div className={`
                  absolute inset-0 transition-all duration-200
                  ${isSelected ? "bg-accent-blue/20" : "bg-black/0 hover:bg-black/20"}
                `} />

                {/* Status indicators */}
                <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
                  {isEnlarged && (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <CheckIcon className="w-3 h-3" />
                      4K
                    </span>
                  )}
                  {hasExtractedText && (
                    <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <EditIcon className="w-3 h-3" />
                      可编辑
                    </span>
                  )}
                  {isProcessingThis && (
                    <span className="bg-accent-blue text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <LoadingSpinner className="w-3 h-3" />
                      处理中
                    </span>
                  )}
                </div>

                {/* Slide number */}
                <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                  {slide.number}
                </span>

                {/* Selection checkbox */}
                <div className={`
                  absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-all duration-200
                  ${isSelected 
                    ? "bg-accent-blue border-accent-blue" 
                    : "border-white/50 bg-black/30"
                  }
                `}>
                  {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
        <button
          onClick={onPrev}
          disabled={isProcessing}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          返回
        </button>

        <button
          onClick={onNext}
          disabled={isProcessing}
          className="btn-primary flex items-center gap-2"
        >
          {(enlargedCount > 0 || extractedCount > 0) ? "进入展示" : "跳过，进入展示"}
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
