"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "@/app/page";
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  LoadingSpinner, 
  SparklesIcon,
  RefreshIcon 
} from "@/components/icons";
import { getSlideCount } from "@/lib/parse-outline";

interface Step2GenerateProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  totalSlides: number;
  completedSlides: number;
  slides: string[];
  error?: string;
}

export default function Step2Generate({ 
  appState, 
  updateState, 
  onNext, 
  onPrev 
}: Step2GenerateProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const totalSlides = getSlideCount(appState.outline);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/status/${jobId}`);
      if (!response.ok) {
        // Job not found - might be due to server restart, stop polling
        if (response.status === 404) {
          console.warn("Job not found, stopping polling");
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setIsGenerating(false);
          setError("任务状态丢失（可能由于服务器重启）。请重新开始生成。");
          return;
        }
        throw new Error("Failed to fetch job status");
      }
      const status: JobStatus = await response.json();
      setJobStatus(status);

      // Update app state with generated slides
      if (status.slides.length > 0) {
        updateState({
          generatedSlides: status.slides.map((path, index) => ({
            number: index + 1,
            path,
          })),
        });
      }

      // Stop polling if completed or failed
      if (status.status === "completed" || status.status === "failed") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsGenerating(false);
      }
    } catch (err) {
      console.error("Error polling job status:", err);
    }
  }, [updateState]);

  // Start generation
  const startGeneration = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setJobStatus(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: appState.apiKey,
          outline: appState.outline,
          visualGuideline: appState.visualGuideline,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start generation");
      }

      const { jobId, totalSlides: total } = await response.json();
      updateState({ currentJobId: jobId });
      
      setJobStatus({
        id: jobId,
        status: "processing",
        progress: 0,
        totalSlides: total,
        completedSlides: 0,
        slides: [],
      });

      // Start polling
      pollingRef.current = setInterval(() => {
        pollJobStatus(jobId);
      }, 2000);

    } catch (err) {
      setIsGenerating(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [appState.apiKey, appState.outline, appState.visualGuideline, updateState, pollJobStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Auto-start if coming back to this step with a pending job
  useEffect(() => {
    if (appState.currentJobId && !jobStatus && !isGenerating) {
      pollJobStatus(appState.currentJobId);
      pollingRef.current = setInterval(() => {
        pollJobStatus(appState.currentJobId!);
      }, 2000);
    }
  }, [appState.currentJobId, jobStatus, isGenerating, pollJobStatus]);

  const isComplete = jobStatus?.status === "completed";
  const isFailed = jobStatus?.status === "failed";
  const canProceed = isComplete && appState.generatedSlides.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">生成幻灯片</h2>
        <p className="text-white/60">
          {isGenerating 
            ? "正在使用 Gemini AI 生成你的幻灯片..." 
            : isFailed
              ? "生成失败，请检查错误信息并重试"
              : isComplete && appState.generatedSlides.length > 0
                ? "生成完成！查看预览并继续下一步"
                : isComplete && appState.generatedSlides.length === 0
                  ? "生成完成但没有幻灯片，请检查配置"
                  : `准备生成 ${totalSlides} 页幻灯片`}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Progress Section */}
        {(isGenerating || jobStatus) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {jobStatus?.completedSlides || 0} / {jobStatus?.totalSlides || totalSlides} 页
              </span>
              <span className="text-sm text-white/60">
                {jobStatus?.progress || 0}%
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full accent-gradient transition-all duration-500 ease-out"
                style={{ width: `${jobStatus?.progress || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {(error || isFailed) && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm font-medium mb-1">生成失败</p>
            <p className="text-red-400/80 text-sm whitespace-pre-wrap">
              {(() => {
                const errMsg = error || jobStatus?.error || "";
                if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
                  return "API 配额已用尽。请稍后重试，或者检查你的 Google Cloud 账单和配额设置。\n\n提示：免费版 Gemini API 有每日请求限制。";
                }
                if (errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED")) {
                  return "API Key 无效或已过期。请检查你的 API Key 是否正确。";
                }
                return errMsg || "未知错误，请检查 API Key 是否正确，以及 Python 环境是否配置正确";
              })()}
            </p>
          </div>
        )}

        {/* Slides Preview Grid */}
        {appState.generatedSlides.length > 0 ? (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {appState.generatedSlides.map((slide) => (
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
                      // Handle image load error
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute bottom-2 left-2 text-xs bg-black/50 px-2 py-1 rounded">
                    {slide.number}
                  </span>
                </div>
              ))}
              
              {/* Placeholder for slides being generated */}
              {isGenerating && Array.from({ 
                length: (jobStatus?.totalSlides || totalSlides) - appState.generatedSlides.length 
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
              <p className="text-white/60">正在生成中...</p>
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
          {(error || isFailed) && (
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

