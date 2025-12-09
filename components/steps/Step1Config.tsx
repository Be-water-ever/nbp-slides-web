"use client";

import { useState, useRef, useCallback } from "react";
import { AppState } from "@/app/page";
import { KeyIcon, DocumentIcon, UploadIcon, ArrowRightIcon, XIcon } from "@/components/icons";
import { getSlideCount } from "@/lib/parse-outline";

interface Step1ConfigProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onNext: () => void;
}

export default function Step1Config({ appState, updateState, onNext }: Step1ConfigProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"outline" | "guideline">("outline");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slideCount = getSlideCount(appState.outline);
  const isValid = appState.apiKey.length >= 20 && slideCount > 0;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      // For MVP, we just track the file names
      // In production, you'd upload to server
      const reader = new FileReader();
      reader.onload = () => {
        updateState({
          uploadedAssets: [
            ...appState.uploadedAssets,
            { name: file.name, path: `uploads/${file.name}` },
          ],
        });
      };
      reader.readAsDataURL(file);
    });
  }, [appState.uploadedAssets, updateState]);

  const removeAsset = useCallback((name: string) => {
    updateState({
      uploadedAssets: appState.uploadedAssets.filter((a) => a.name !== name),
    });
  }, [appState.uploadedAssets, updateState]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">配置你的幻灯片</h2>
        <p className="text-white/60">输入 API Key，编辑大纲和视觉指南</p>
      </div>

      {/* API Key Input */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-medium mb-2">
          <KeyIcon className="w-4 h-4" />
          Google API Key
        </label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={appState.apiKey}
            onChange={(e) => updateState({ apiKey: e.target.value })}
            placeholder="输入你的 Gemini API Key (AIza...)"
            className="input-glass pr-20"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-sm"
          >
            {showApiKey ? "隐藏" : "显示"}
          </button>
        </div>
        <p className="mt-2 text-xs text-white/40">
          你的 API Key 仅在本地使用，不会被存储或传输到我们的服务器
        </p>
      </div>

      {/* Editor Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setActiveTab("outline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === "outline"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <DocumentIcon className="w-4 h-4" />
            大纲 ({slideCount} 页)
          </button>
          <button
            onClick={() => setActiveTab("guideline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === "guideline"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <DocumentIcon className="w-4 h-4" />
            视觉指南
          </button>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col min-h-0">
            <textarea
              value={activeTab === "outline" ? appState.outline : appState.visualGuideline}
              onChange={(e) =>
                updateState(
                  activeTab === "outline"
                    ? { outline: e.target.value }
                    : { visualGuideline: e.target.value }
                )
              }
              className="flex-1 input-glass font-mono text-sm resize-none p-4"
              placeholder={
                activeTab === "outline"
                  ? "在此编辑幻灯片大纲 (Markdown 格式)..."
                  : "在此编辑视觉设计指南..."
              }
              spellCheck={false}
            />
          </div>

          {/* Asset Upload Panel */}
          <div className="w-64 flex flex-col">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <UploadIcon className="w-4 h-4" />
              资产文件
            </h3>
            
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center 
                         hover:border-accent-blue/50 hover:bg-white/5 transition-all cursor-pointer mb-4"
            >
              <UploadIcon className="w-8 h-8 mx-auto mb-2 text-white/40" />
              <p className="text-sm text-white/60">点击上传图片</p>
              <p className="text-xs text-white/40 mt-1">Logo, QR码等</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Uploaded assets list */}
            <div className="flex-1 overflow-auto space-y-2">
              {appState.uploadedAssets.map((asset) => (
                <div
                  key={asset.name}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-sm truncate flex-1">{asset.name}</span>
                  <button
                    onClick={() => removeAsset(asset.name)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <XIcon className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              ))}
              {appState.uploadedAssets.length === 0 && (
                <p className="text-xs text-white/40 text-center py-4">
                  暂无上传的资产
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
        <div className="text-sm text-white/50">
          {!isValid && (
            <span className="text-amber-400">
              {appState.apiKey.length < 20
                ? "请输入有效的 API Key"
                : "大纲中未检测到幻灯片"}
            </span>
          )}
        </div>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="btn-primary flex items-center gap-2"
        >
          开始生成
          <ArrowRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

