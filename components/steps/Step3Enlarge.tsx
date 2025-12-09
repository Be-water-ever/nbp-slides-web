"use client";

import { useState, useCallback } from "react";
import { AppState } from "@/app/page";
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  ExpandIcon,
  LoadingSpinner,
  CheckIcon
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
  const [enlargingSlides, setEnlargingSlides] = useState<Set<number>>(new Set());
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

  const enlargeSlide = useCallback(async (slide: { number: number; path: string }) => {
    setEnlargingSlides((prev) => new Set(prev).add(slide.number));
    
    try {
      const response = await fetch("/api/enlarge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: appState.apiKey,
          imageUrl: slide.path, // Now using URL directly
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Enlargement failed");
      }

      const { enlargedPath } = await response.json();

      // Update the slide with enlarged path
      updateState({
        generatedSlides: appState.generatedSlides.map((s) =>
          s.number === slide.number ? { ...s, enlarged: enlargedPath } : s
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEnlargingSlides((prev) => {
        const next = new Set(prev);
        next.delete(slide.number);
        return next;
      });
    }
  }, [appState.apiKey, appState.currentJobId, appState.generatedSlides, updateState]);

  const enlargeSelected = useCallback(async () => {
    setError(null);
    const slidesToEnlarge = appState.generatedSlides.filter(
      (s) => selectedSlides.has(s.number) && !s.enlarged
    );

    for (const slide of slidesToEnlarge) {
      await enlargeSlide(slide);
    }
  }, [appState.generatedSlides, selectedSlides, enlargeSlide]);

  const enlargedCount = appState.generatedSlides.filter((s) => s.enlarged).length;
  const isEnlarging = enlargingSlides.size > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">优化放大 (可选)</h2>
        <p className="text-white/60">
          选择要放大到 4K 分辨率的幻灯片，或直接跳过进入展示
        </p>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between mb-4">
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
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">
            已选择 {selectedSlides.size} 页 · 已放大 {enlargedCount} 页
          </span>
          <button
            onClick={enlargeSelected}
            disabled={selectedSlides.size === 0 || isEnlarging}
            className="btn-secondary flex items-center gap-2"
          >
            {isEnlarging ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              <ExpandIcon className="w-4 h-4" />
            )}
            放大选中 ({selectedSlides.size})
          </button>
        </div>
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
            const isEnlargingThis = enlargingSlides.has(slide.number);
            const isEnlarged = !!slide.enlarged;

            return (
              <div
                key={slide.number}
                onClick={() => !isEnlargingThis && toggleSlide(slide.number)}
                className={`
                  aspect-video rounded-xl overflow-hidden relative cursor-pointer
                  transition-all duration-200
                  ${isSelected ? "ring-2 ring-accent-blue ring-offset-2 ring-offset-background" : ""}
                  ${isEnlarged ? "ring-2 ring-green-500/50" : ""}
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
                <div className="absolute top-2 right-2 flex gap-2">
                  {isEnlarged && (
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <CheckIcon className="w-3 h-3" />
                      4K
                    </span>
                  )}
                  {isEnlargingThis && (
                    <span className="bg-accent-blue text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <LoadingSpinner className="w-3 h-3" />
                      放大中
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
          disabled={isEnlarging}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          返回
        </button>

        <button
          onClick={onNext}
          disabled={isEnlarging}
          className="btn-primary flex items-center gap-2"
        >
          {enlargedCount > 0 ? "进入展示" : "跳过，进入展示"}
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

