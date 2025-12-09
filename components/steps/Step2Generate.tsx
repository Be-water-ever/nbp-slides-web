"use client";

import { useState, useCallback, useRef } from "react";
import { AppState, TextBlock } from "@/app/page";
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  LoadingSpinner, 
  SparklesIcon,
  RefreshIcon 
} from "@/components/icons";
import { parseOutline, getSlideCount } from "@/lib/parse-outline";

interface Step2GenerateProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

interface GeneratedSlide {
  number: number;
  path: string;
  textBlocks?: TextBlock[];
}

interface GenerationProgress {
  totalSlides: number;
  completedSlides: number;
  currentSlideTitle: string;
  status: "idle" | "generating" | "completed" | "failed";
  error?: string;
}

export default function Step2Generate({ 
  appState, 
  updateState, 
  onNext, 
  onPrev 
}: Step2GenerateProps) {
  const [progress, setProgress] = useState<GenerationProgress>({
    totalSlides: getSlideCount(appState.outline),
    completedSlides: 0,
    currentSlideTitle: "",
    status: "idle",
  });
  const [generatedSlides, setGeneratedSlides] = useState<GeneratedSlide[]>(
    appState.generatedSlides || []
  );
  const abortRef = useRef(false);

  const totalSlides = getSlideCount(appState.outline);

  // Generate slides one by one
  const startGeneration = useCallback(async () => {
    abortRef.current = false;
    setProgress(prev => ({ 
      ...prev, 
      status: "generating", 
      error: undefined,
      completedSlides: 0,
    }));
    setGeneratedSlides([]);

    // Parse outline to get individual slides
    const slides = parseOutline(appState.outline, 1, 99);
    setProgress(prev => ({ ...prev, totalSlides: slides.length }));

    const newSlides: GeneratedSlide[] = [];

    for (let i = 0; i < slides.length; i++) {
      if (abortRef.current) {
        setProgress(prev => ({ ...prev, status: "idle" }));
        return;
      }

      const slide = slides[i];
      setProgress(prev => ({ 
        ...prev, 
        currentSlideTitle: slide.title || `幻灯片 ${i + 1}`,
      }));

      try {
        // Build prompt for this slide
        const prompt = `
You are an expert presentation designer for a high-end tech keynote.

VISUAL GUIDELINES (MUST FOLLOW):
${appState.visualGuideline}

SLIDE CONTENT:
${slide.content}

TASK:
Generate a high-resolution, 16:9 slide image that perfectly represents the content above while strictly adhering to the visual guidelines.
The image should be the final slide itself, including any text or graphical elements described.
Make it look like a professional slide from a Keynote presentation.
${slide.assetPaths && slide.assetPaths.length > 0 ? `

**CRITICAL INSTRUCTION FOR PROVIDED IMAGES**:
I have attached ${slide.assetPaths.length} image(s) that MUST be embedded directly into this slide.
- DO NOT recreate, redraw, or re-interpret these images
- Place them EXACTLY as they are provided
- These are functional assets (logos, QR codes, product photos) that must appear pixel-perfect
- Integrate them naturally into the slide layout at appropriate positions` : ""}
        `.trim();

        // Filter asset paths to only include URLs
        const assetUrls = slide.assetPaths?.filter((p: string) => p.startsWith("http")) || [];

        // Call the single slide generation API
        const response = await fetch("/api/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: appState.apiKey,
            prompt,
            assetUrls,
          }),
        });

        const result = await response.json();

        if (result.success && result.image_url) {
          const newSlide: GeneratedSlide = {
            number: slide.number,
            path: result.image_url,
            textBlocks: result.text_blocks || [],
          };
          newSlides.push(newSlide);
          setGeneratedSlides([...newSlides]);
          
          setProgress(prev => ({
            ...prev,
            completedSlides: prev.completedSlides + 1,
          }));
        } else {
          // Slide failed but continue with others
          console.error(`Slide ${slide.number} failed:`, result.error);
          setProgress(prev => ({
            ...prev,
            completedSlides: prev.completedSlides + 1,
            error: `第 ${slide.number} 页生成失败: ${result.error}`,
          }));
        }
      } catch (err) {
        console.error(`Error generating slide ${slide.number}:`, err);
        setProgress(prev => ({
          ...prev,
          completedSlides: prev.completedSlides + 1,
          error: `第 ${slide.number} 页生成失败: ${err instanceof Error ? err.message : "网络错误"}`,
        }));
      }
    }

    // All done
    setProgress(prev => ({ 
      ...prev, 
      status: newSlides.length > 0 ? "completed" : "failed",
      currentSlideTitle: "",
    }));

    // Update app state with all generated slides
    if (newSlides.length > 0) {
      updateState({ generatedSlides: newSlides });
    }
  }, [appState.apiKey, appState.outline, appState.visualGuideline, updateState]);

  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
  }, []);

  const progressPercent = progress.totalSlides > 0 
    ? Math.round((progress.completedSlides / progress.totalSlides) * 100)
    : 0;

  const isGenerating = progress.status === "generating";
  const isComplete = progress.status === "completed";
  const isFailed = progress.status === "failed";
  const canProceed = isComplete && generatedSlides.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">生成幻灯片</h2>
        <p className="text-white/60">
          {isGenerating 
            ? `正在生成: ${progress.currentSlideTitle || "准备中..."}` 
            : isFailed
              ? "生成失败，请检查错误信息并重试"
              : isComplete && generatedSlides.length > 0
                ? `成功生成 ${generatedSlides.length} 页幻灯片！`
                : isComplete && generatedSlides.length === 0
                  ? "生成完成但没有幻灯片，请检查配置"
                  : `准备生成 ${totalSlides} 页幻灯片`}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Progress Section */}
        {(isGenerating || progress.completedSlides > 0) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {progress.completedSlides} / {progress.totalSlides} 页
              </span>
              <span className="text-sm text-white/60">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full accent-gradient transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {progress.error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm font-medium mb-1">生成遇到问题</p>
            <p className="text-red-400/80 text-sm whitespace-pre-wrap">
              {(() => {
                const errMsg = progress.error;
                if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
                  return "API 配额已用尽。请稍后重试，或者检查你的 Google Cloud 账单和配额设置。\n\n提示：免费版 Gemini API 有每日请求限制。";
                }
                if (errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED")) {
                  return "API Key 无效或已过期。请检查你的 API Key 是否正确。";
                }
                return errMsg;
              })()}
            </p>
          </div>
        )}

        {/* Slides Preview Grid */}
        {generatedSlides.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {generatedSlides.map((slide) => (
                <div 
                  key={slide.number}
                  className="aspect-video bg-white/5 rounded-xl overflow-hidden relative group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.path}
                    alt={`Slide ${slide.number}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                    {slide.number}
                    {slide.textBlocks && slide.textBlocks.length > 0 && (
                      <span className="ml-1 text-accent-blue">✏️</span>
                    )}
                  </span>
                </div>
              ))}
              
              {/* Placeholder for slides being generated */}
              {isGenerating && Array.from({ 
                length: progress.totalSlides - generatedSlides.length 
              }).map((_, i) => (
                <div 
                  key={`placeholder-${i}`}
                  className="aspect-video bg-white/5 rounded-xl flex items-center justify-center"
                >
                  <LoadingSpinner className="w-8 h-8 text-white/30" />
                </div>
              ))}
            </div>
          </div>
        ) : !isGenerating ? (
          /* Start Generation Button */
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={startGeneration}
              className="flex flex-col items-center gap-4 p-8 rounded-2xl glass-panel glass-panel-hover cursor-pointer transition-all hover:scale-105"
            >
              <div className="w-20 h-20 rounded-full accent-gradient flex items-center justify-center animate-pulse-glow">
                <SparklesIcon className="w-10 h-10 text-white" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">开始生成</p>
                <p className="text-sm text-white/60 mt-1">
                  生成 {totalSlides} 页 1K 预览图
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* Loading State */
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner className="w-16 h-16 text-accent-blue" />
              <p className="text-white/60">正在生成: {progress.currentSlideTitle}</p>
              <button
                onClick={cancelGeneration}
                className="text-sm text-white/40 hover:text-white/60"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
        <button
          onClick={onPrev}
          disabled={isGenerating}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          返回
        </button>

        <div className="flex gap-3">
          {(progress.error || isFailed || (isComplete && generatedSlides.length === 0)) && (
            <button
              onClick={startGeneration}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshIcon className="w-5 h-5" />
              重试
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="btn-primary flex items-center gap-2"
          >
            下一步：优化放大
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
