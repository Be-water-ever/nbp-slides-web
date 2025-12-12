"use client";

import { CheckIcon } from "./icons";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <nav className="w-full mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || step.id === currentStep);
          
          return (
            <li 
              key={step.id} 
              className={`flex-1 ${index < steps.length - 1 ? "relative" : ""}`}
            >
              <div 
                className={`flex flex-col items-center ${isClickable ? "cursor-pointer" : ""}`}
                onClick={() => isClickable && onStepClick?.(step.id)}
              >
                {/* Step indicator */}
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    transition-all duration-300 relative z-10
                    ${isCompleted 
                      ? "bg-gradient-to-br from-accent-blue to-accent-purple shadow-lg shadow-accent-blue/30" 
                      : isCurrent
                        ? "glass-panel border-2 border-accent-blue shadow-lg shadow-accent-blue/20"
                        : "glass-panel border border-glass-border"
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-6 h-6 text-white" />
                  ) : (
                    <span className={`text-lg font-semibold ${isCurrent ? "accent-gradient-text" : "text-white/50"}`}>
                      {step.id}
                    </span>
                  )}
                </div>
                
                {/* Step label */}
                <div className="mt-3 text-center">
                  <p className={`text-sm font-medium ${isCurrent ? "text-white" : "text-white/60"}`}>
                    {step.title}
                  </p>
                  <p className={`text-xs mt-1 ${isCurrent ? "text-white/70" : "text-white/40"}`}>
                    {step.description}
                  </p>
                </div>
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div 
                  className="absolute top-[22px] h-0.5 -z-0"
                  style={{ transform: "translateX(50%)", width: "240px", left: "62px" }}
                >
                  <div 
                    className={`
                      h-full transition-all duration-500
                      ${isCompleted 
                        ? "bg-gradient-to-r from-accent-blue to-accent-purple" 
                        : "bg-glass-border"
                      }
                    `}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Step definitions for the slide generation workflow
export const WORKFLOW_STEPS: Step[] = [
  {
    id: 1,
    title: "配置",
    description: "API Key & 大纲",
  },
  {
    id: 2,
    title: "生成",
    description: "1K 预览",
  },
  {
    id: 3,
    title: "优化",
    description: "4K 放大",
  },
  {
    id: 4,
    title: "展示",
    description: "演示 & 下载",
  },
];



