"use client";

import { useState, useCallback } from "react";
import Stepper, { WORKFLOW_STEPS } from "@/components/Stepper";
import Step1Config from "@/components/steps/Step1Config";
import Step2Generate from "@/components/steps/Step2Generate";
import Step3Enlarge from "@/components/steps/Step3Enlarge";
import Step4Present from "@/components/steps/Step4Present";

// Text block from OCR
export interface TextBlock {
  content: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  size: "large" | "medium" | "small" | "tiny";
  align: "left" | "center" | "right";
  color: string;
  // User-customizable overrides
  customFontSize?: number;  // px value, overrides size
  customColor?: string;     // hex value, overrides color
}

// Image block for user-added images
export interface ImageBlock {
  id: string;
  src: string;              // data URL or uploaded URL
  x_percent: number;
  y_percent: number;
  width_percent: number;
  aspectRatio: number;      // original aspect ratio for Shift-resize
}

// Slide structure
export interface GeneratedSlide {
  number: number;
  path: string;              // Original image URL
  enlarged?: string;         // 4K enlarged image URL (optional)
  cleanPath?: string;        // Image with text removed (optional)
  textBlocks?: TextBlock[];  // OCR-extracted text for editing (optional)
  imageBlocks?: ImageBlock[]; // User-added images (optional)
}

// Application state type
export interface AppState {
  apiKey: string;
  outline: string;
  visualGuideline: string;
  uploadedAssets: { name: string; path: string }[];
  generatedSlides: GeneratedSlide[];
  currentJobId: string | null;
}

const DEFAULT_OUTLINE = `# Slide Outline

#### Slide 1: Title
*   **Layout**: Minimalist Title.
*   **Scene**:
    *   **Prompt**: A cinematic title slide with elegant typography.
*   **Asset**: None

#### Slide 2: Introduction
*   **Layout**: Split composition.
*   **Scene**:
    *   **Prompt**: A professional introduction slide with key points.
*   **Asset**: None

# 提示：如需使用已上传的图片（跳过AI生成），请使用以下语法：
# #### Slide 3: 已有图片
# *   **Upload**: @filename.png  (开发环境) 或 https://你的R2地址/slides/xxx.png (生产环境)
`;

const DEFAULT_GUIDELINE = `# Visual Design Language

**Role**: You are the "Generative Kernel", an AI rendering engine for high-end presentation slides.

## The Visual Style - "The Glass Garden"

### Core Metaphor
*   **Concept**: Ethereal, Frosted Glass, Soft Light, Spatial UI, Clean, Minimalist.
*   **Background**: #F5F5F7 (Off-white/Light Grey).
*   **Typography**: San Francisco / Inter (Deep Grey #333333).

## Language Rules
*   **Language**: 使用简体中文（Simplified Chinese）（除专有名词可以用英文标注）。
`;

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [appState, setAppState] = useState<AppState>({
    apiKey: "",
    outline: DEFAULT_OUTLINE,
    visualGuideline: DEFAULT_GUIDELINE,
    uploadedAssets: [],
    generatedSlides: [],
    currentJobId: null,
  });

  const updateState = useCallback((updates: Partial<AppState>) => {
    setAppState((prev) => ({ ...prev, ...updates }));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 4) {
      setCurrentStep(step);
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-12 animate-slide-up">
          <h1 className="text-4xl font-bold mb-3">
            <span className="accent-gradient-text">NBP Slides</span>
          </h1>
          <p className="text-white/60 text-lg">
            AI 驱动的幻灯片生成器 · 使用你的 Google API Key
          </p>
        </header>

        {/* Stepper */}
        <div className="mb-8">
          <Stepper 
            steps={WORKFLOW_STEPS} 
            currentStep={currentStep} 
            onStepClick={goToStep}
            allowFutureSteps={appState.generatedSlides.length > 0}
          />
        </div>

        {/* Step Content */}
        <div className="glass-panel p-8 min-h-[600px] animate-slide-up" style={{ animationDelay: "0.1s" }}>
          {currentStep === 1 && (
            <Step1Config
              appState={appState}
              updateState={updateState}
              onNext={nextStep}
            />
          )}
          {currentStep === 2 && (
            <Step2Generate
              appState={appState}
              updateState={updateState}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 3 && (
            <Step3Enlarge
              appState={appState}
              updateState={updateState}
              onNext={nextStep}
              onPrev={prevStep}
            />
          )}
          {currentStep === 4 && (
            <Step4Present
              appState={appState}
              updateState={updateState}
              onPrev={prevStep}
              onRestart={() => {
                setCurrentStep(1);
                setAppState({
                  ...appState,
                  generatedSlides: [],
                  currentJobId: null,
                });
              }}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 text-white/40 text-sm">
          <p>Powered by Gemini AI · Built with the Generative Kernel philosophy</p>
        </footer>
      </div>
    </main>
  );
}
