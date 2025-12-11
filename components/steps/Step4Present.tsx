"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AppState, TextBlock, GeneratedSlide, ImageBlock } from "@/app/page";
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

// Generate unique ID for new elements
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

interface Step4PresentProps {
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onPrev: () => void;
  onRestart: () => void;
}

type DownloadFormat = "png" | "pdf" | "pptx";

// Helper to get font size from OCR size label (returns px value)
function getFontSizePx(size: string): number {
  switch (size) {
    case "large": return 48;
    case "medium": return 32;
    case "small": return 24;
    case "tiny": return 16;
    default: return 24;
  }
}

// Get the best image URL for a slide (clean > enlarged > original)
function getDisplayUrl(slide: GeneratedSlide, preferClean: boolean = true): string {
  if (preferClean && slide.cleanPath) {
    return slide.cleanPath;
  }
  return slide.enlarged || slide.path;
}

// Draggable and editable text block component
function DraggableTextBlock({ 
  block, 
  blockIndex,
  isSelected,
  onSelect,
  onUpdateContent,
  onUpdatePosition,
  containerRef,
}: { 
  block: TextBlock;
  blockIndex: number;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdateContent: (content: string) => void;
  onUpdatePosition: (x: number, y: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, blockX: 0, blockY: 0 });

  const fontSize = block.customFontSize || getFontSizePx(block.size);
  const color = block.customColor || block.color || "#333333";

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(e);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      blockX: block.x_percent,
      blockY: block.y_percent,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
    
    const newX = Math.max(0, Math.min(100, dragStartRef.current.blockX + deltaX));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.blockY + deltaY));
    
    onUpdatePosition(newX, newY);
  }, [isDragging, containerRef, onUpdatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    onSelect(e);
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (textRef.current) {
      onUpdateContent(textRef.current.innerText);
    }
  };

  return (
    <div
      ref={textRef}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      className={`absolute select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${
        isSelected 
          ? "outline outline-2 outline-accent-blue shadow-lg" 
          : "hover:outline hover:outline-1 hover:outline-white/50"
      } ${
        isEditing ? "cursor-text bg-black/20 rounded px-2" : ""
      }`}
      style={{
        left: `${block.x_percent}%`,
        top: `${block.y_percent}%`,
        width: `${block.width_percent}%`,
        transform: "translate(-50%, -50%)",
        fontSize: `${fontSize}px`,
        color: color,
        textAlign: block.align as "left" | "center" | "right" || "center",
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        fontWeight: block.size === "large" ? 600 : 400,
        lineHeight: 1.3,
        textShadow: "0 1px 3px rgba(0,0,0,0.1)",
        whiteSpace: "pre-wrap",
        zIndex: isSelected ? 10 : 1,
      }}
    >
      {block.content}
    </div>
  );
}

// Inline text block controls (integrated into toolbar)
function InlineTextBlockControls({
  selectedBlocks,
  onUpdateFontSize,
  onUpdateColor,
  onDelete,
  onSelectAll,
  totalBlocks,
}: {
  selectedBlocks: TextBlock[];
  onUpdateFontSize: (size: number) => void;
  onUpdateColor: (color: string) => void;
  onDelete: () => void;
  onSelectAll: () => void;
  totalBlocks: number;
}) {
  // Get common values or show placeholder for mixed
  const firstBlock = selectedBlocks[0];
  const currentFontSize = firstBlock?.customFontSize || getFontSizePx(firstBlock?.size || "medium");
  const currentColor = firstBlock?.customColor || firstBlock?.color || "#333333";

  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore - EyeDropper API
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        onUpdateColor(result.sRGBHex);
      } catch (e) {
        // User cancelled
      }
    } else {
      alert("您的浏览器不支持吸色功能，请使用 Chrome 95+ 或 Edge 95+");
    }
  };

  const hasSelection = selectedBlocks.length > 0;

  return (
    <>
      {/* Selection info & select all */}
      <div className="flex items-center gap-2 border-l border-white/20 pl-4">
        <span className="text-xs text-white/60">
          {hasSelection ? `已选 ${selectedBlocks.length}/${totalBlocks}` : `共 ${totalBlocks} 个文字块`}
        </span>
        <button
          onClick={onSelectAll}
          className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
        >
          全选
        </button>
      </div>

      {/* Font size control - only show when selected */}
      {hasSelection && (
        <>
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <span className="text-xs text-white/60">字号</span>
            <input
              type="range"
              min="12"
              max="72"
              value={currentFontSize}
              onChange={(e) => onUpdateFontSize(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent-blue"
            />
            <span className="text-xs text-white/80 w-8">{currentFontSize}px</span>
          </div>

          {/* Color control */}
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <span className="text-xs text-white/60">颜色</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onUpdateColor(e.target.value)}
              className="w-6 h-5 rounded cursor-pointer border border-white/20"
            />
            <button
              onClick={handleEyeDropper}
              className="px-1.5 py-0.5 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
              title="吸色"
            >
              🎯
            </button>
          </div>

          {/* Delete button */}
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition-colors border-l border-white/20 ml-2"
            title="删除选中的文字块"
          >
            🗑️ 删除
          </button>
        </>
      )}
    </>
  );
}

// Resizable image block component
function ResizableImageBlock({
  image,
  isSelected,
  onSelect,
  onUpdatePosition,
  onUpdateSize,
  containerRef,
}: {
  image: ImageBlock;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, imgX: 0, imgY: 0 });
  const resizeStartRef = useRef({ x: 0, width: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(e);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      imgX: image.x_percent,
      imgY: image.y_percent,
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      width: image.width_percent,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (isDragging) {
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100, dragStartRef.current.imgX + deltaX));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.imgY + deltaY));
      onUpdatePosition(newX, newY);
    }

    if (isResizing) {
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      let newWidth = Math.max(5, Math.min(100, resizeStartRef.current.width + deltaX));
      onUpdateSize(newWidth);
    }
  }, [isDragging, isResizing, containerRef, onUpdatePosition, onUpdateSize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const heightPercent = image.width_percent / image.aspectRatio;

  return (
    <div
      className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${
        isSelected ? 'outline outline-2 outline-accent-blue' : 'hover:outline hover:outline-1 hover:outline-white/50'
      }`}
      style={{
        left: `${image.x_percent}%`,
        top: `${image.y_percent}%`,
        width: `${image.width_percent}%`,
        paddingBottom: `${heightPercent}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isSelected ? 10 : 1,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt="User added image"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      
      {/* Resize handle - bottom right corner */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-accent-blue cursor-se-resize transform translate-x-1/2 translate-y-1/2 rounded-sm"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}

export default function Step4Present({ 
  appState, 
  updateState,
  onPrev, 
  onRestart 
}: Step4PresentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [editMode, setEditMode] = useState(true);
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<number[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const [localSlides, setLocalSlides] = useState(appState.generatedSlides);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<DownloadFormat>("png");
  
  // History for undo
  const [history, setHistory] = useState<GeneratedSlide[][]>([appState.generatedSlides]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Overlay controls for comparing with original image
  const [showOriginalOverlay, setShowOriginalOverlay] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  
  // Drag and drop for image upload
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const slides = localSlides;
  const currentSlide = slides[currentSlideIndex];
  
  // Check if current slide has editable text (cleanPath means text was extracted)
  const hasEditableText = currentSlide?.cleanPath && currentSlide?.textBlocks && currentSlide.textBlocks.length > 0;
  const hasImages = currentSlide?.imageBlocks && currentSlide.imageBlocks.length > 0;
  
  // Get selected blocks
  const selectedBlocks = hasEditableText 
    ? selectedBlockIndices.map(i => currentSlide.textBlocks![i]).filter(Boolean)
    : [];

  // Save to history when slides change
  const saveToHistory = useCallback((newSlides: GeneratedSlide[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newSlides);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
    setLocalSlides(newSlides);
  }, [historyIndex]);

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLocalSlides(history[newIndex]);
      setSelectedBlockIndices([]);
      setSelectedImageIndices([]);
    }
  }, [historyIndex, history]);

  // Can undo check
  const canUndo = historyIndex > 0;

  // Sync local slides to global state before export
  const syncAndExport = useCallback((exportFunction: () => void | Promise<void>) => {
    // Sync the latest local slides to global state
    updateState({ 
      generatedSlides: localSlides 
    });
    
    // Give state update some time to propagate
    setTimeout(async () => {
      await exportFunction();
    }, 10);
  }, [localSlides, updateState]);

  // Update text block content
  const updateTextBlockContent = useCallback((slideIndex: number, blockIndex: number, content: string) => {
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

  // Update text block position
  const updateTextBlockPosition = useCallback((slideIndex: number, blockIndex: number, x: number, y: number) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[slideIndex] };
      const textBlocks = [...(slide.textBlocks || [])];
      textBlocks[blockIndex] = { ...textBlocks[blockIndex], x_percent: x, y_percent: y };
      slide.textBlocks = textBlocks;
      newSlides[slideIndex] = slide;
      return newSlides;
    });
  }, []);


  // Batch update font size for selected blocks
  const batchUpdateFontSize = useCallback((fontSize: number) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[currentSlideIndex] };
      const textBlocks = [...(slide.textBlocks || [])];
      selectedBlockIndices.forEach(idx => {
        if (textBlocks[idx]) {
          textBlocks[idx] = { ...textBlocks[idx], customFontSize: fontSize };
        }
      });
      slide.textBlocks = textBlocks;
      newSlides[currentSlideIndex] = slide;
      return newSlides;
    });
  }, [currentSlideIndex, selectedBlockIndices]);

  // Batch update color for selected blocks
  const batchUpdateColor = useCallback((color: string) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[currentSlideIndex] };
      const textBlocks = [...(slide.textBlocks || [])];
      selectedBlockIndices.forEach(idx => {
        if (textBlocks[idx]) {
          textBlocks[idx] = { ...textBlocks[idx], customColor: color };
        }
      });
      slide.textBlocks = textBlocks;
      newSlides[currentSlideIndex] = slide;
      return newSlides;
    });
  }, [currentSlideIndex, selectedBlockIndices]);

  // Delete selected blocks (text or images)
  const deleteSelectedBlocks = useCallback(() => {
    if (selectedBlockIndices.length === 0 && selectedImageIndices.length === 0) return;
    
    const newSlides = [...localSlides];
    const slide = { ...newSlides[currentSlideIndex] };
    
    if (selectedBlockIndices.length > 0) {
      slide.textBlocks = (slide.textBlocks || []).filter((_, idx) => !selectedBlockIndices.includes(idx));
    }
    if (selectedImageIndices.length > 0) {
      slide.imageBlocks = (slide.imageBlocks || []).filter((_, idx) => !selectedImageIndices.includes(idx));
    }
    
    newSlides[currentSlideIndex] = slide;
    saveToHistory(newSlides);
    setSelectedBlockIndices([]);
    setSelectedImageIndices([]);
  }, [currentSlideIndex, selectedBlockIndices, selectedImageIndices, localSlides, saveToHistory]);

  // Select all blocks
  const selectAllBlocks = useCallback(() => {
    if (hasEditableText && currentSlide.textBlocks) {
      setSelectedBlockIndices(currentSlide.textBlocks.map((_, i) => i));
    }
  }, [hasEditableText, currentSlide]);

  // Handle block selection (with Shift for multi-select)
  const handleBlockSelect = useCallback((blockIndex: number, e: React.MouseEvent) => {
    setSelectedImageIndices([]); // Deselect images when selecting text
    if (e.shiftKey) {
      setSelectedBlockIndices(prev => 
        prev.includes(blockIndex) 
          ? prev.filter(i => i !== blockIndex)
          : [...prev, blockIndex]
      );
    } else {
      setSelectedBlockIndices([blockIndex]);
    }
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((imageIndex: number, e: React.MouseEvent) => {
    setSelectedBlockIndices([]); // Deselect text when selecting images
    if (e.shiftKey) {
      setSelectedImageIndices(prev => 
        prev.includes(imageIndex) 
          ? prev.filter(i => i !== imageIndex)
          : [...prev, imageIndex]
      );
    } else {
      setSelectedImageIndices([imageIndex]);
    }
  }, []);

  // Deselect when clicking outside
  const handleContainerClick = useCallback(() => {
    setSelectedBlockIndices([]);
    setSelectedImageIndices([]);
  }, []);

  // Add new text block
  const addNewTextBlock = useCallback(() => {
    const newSlides = [...localSlides];
    const slide = { ...newSlides[currentSlideIndex] };
    const newBlock: TextBlock = {
      content: "双击编辑文字",
      x_percent: 50,
      y_percent: 50,
      width_percent: 40,
      size: "medium",
      align: "center",
      color: "#333333",
    };
    slide.textBlocks = [...(slide.textBlocks || []), newBlock];
    newSlides[currentSlideIndex] = slide;
    saveToHistory(newSlides);
  }, [currentSlideIndex, localSlides, saveToHistory]);

  // Add image from file
  const addImageFromFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const newImage: ImageBlock = {
          id: generateId(),
          src: e.target?.result as string,
          x_percent: 50,
          y_percent: 50,
          width_percent: 30,
          aspectRatio,
        };
        const newSlides = [...localSlides];
        const slide = { ...newSlides[currentSlideIndex] };
        slide.imageBlocks = [...(slide.imageBlocks || []), newImage];
        newSlides[currentSlideIndex] = slide;
        saveToHistory(newSlides);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [currentSlideIndex, localSlides, saveToHistory]);

  // Update image position
  const updateImagePosition = useCallback((imageIndex: number, x: number, y: number) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[currentSlideIndex] };
      const imageBlocks = [...(slide.imageBlocks || [])];
      if (imageBlocks[imageIndex]) {
        imageBlocks[imageIndex] = { ...imageBlocks[imageIndex], x_percent: x, y_percent: y };
      }
      slide.imageBlocks = imageBlocks;
      newSlides[currentSlideIndex] = slide;
      return newSlides;
    });
  }, [currentSlideIndex]);

  // Update image size
  const updateImageSize = useCallback((imageIndex: number, width: number) => {
    setLocalSlides(prev => {
      const newSlides = [...prev];
      const slide = { ...newSlides[currentSlideIndex] };
      const imageBlocks = [...(slide.imageBlocks || [])];
      if (imageBlocks[imageIndex]) {
        imageBlocks[imageIndex] = { ...imageBlocks[imageIndex], width_percent: width };
      }
      slide.imageBlocks = imageBlocks;
      newSlides[currentSlideIndex] = slide;
      return newSlides;
    });
  }, [currentSlideIndex]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(addImageFromFile);
  }, [addImageFromFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if editing text
      if (document.activeElement?.getAttribute('contenteditable') === 'true') return;
      
      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedBlockIndices.length > 0 || selectedImageIndices.length > 0)) {
        e.preventDefault();
        deleteSelectedBlocks();
      }
      
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockIndices, selectedImageIndices, deleteSelectedBlocks, undo]);

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
    
    const actualExport = async () => {
      setIsExporting(true);
      try {
        const currentSlideData = localSlides[currentSlideIndex];
        if (exportFormat === "png") {
          await downloadSlideAsPNG(currentSlideData, currentSlideData.number);
        } else if (exportFormat === "pdf") {
          await downloadSlidesAsPDF([currentSlideData]);
        } else if (exportFormat === "pptx") {
          await downloadSlidesAsPPTX([currentSlideData]);
        }
      } catch (error) {
        console.error("Download failed:", error);
        alert("下载失败，请重试");
      } finally {
        setIsExporting(false);
      }
    };
    
    syncAndExport(actualExport);
  }, [localSlides, currentSlideIndex, exportFormat, syncAndExport]);

  // Download all slides with selected format
  const downloadAllSlides = useCallback(async () => {
    const actualExport = async () => {
      setIsExporting(true);
      try {
        if (exportFormat === "png") {
          await downloadAllSlidesAsPNG(localSlides);
        } else if (exportFormat === "pdf") {
          await downloadSlidesAsPDF(localSlides);
        } else if (exportFormat === "pptx") {
          await downloadSlidesAsPPTX(localSlides);
        }
      } catch (error) {
        console.error("Download failed:", error);
        alert("下载失败，请重试");
      } finally {
        setIsExporting(false);
      }
    };
    
    syncAndExport(actualExport);
  }, [localSlides, exportFormat, syncAndExport]);

  // Export as HTML with editable text overlay (uses clean images where available)
  const exportAsHTML = useCallback(() => {
    const actualExport = () => {
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
${localSlides.map((slide, index) => {
  const imageUrl = slide.cleanPath || slide.enlarged || slide.path;
  const hasText = slide.cleanPath && slide.textBlocks && slide.textBlocks.length > 0;
  
  return `
      <section>
        <div class="slide-container">
          <img class="slide-bg" src="${imageUrl}" alt="Slide ${index + 1}">
${hasText ? (slide.textBlocks || []).map(block => {
  const effectiveColor = block.customColor || block.color;
  const effectiveFontSize = block.customFontSize;
  const fontSizeStyle = effectiveFontSize ? `font-size:${effectiveFontSize}px;` : '';
  return `
          <div class="text-block text-${block.size}" contenteditable="true"
               style="left:${block.x_percent}%;top:${block.y_percent}%;width:${block.width_percent}%;color:${effectiveColor};text-align:${block.align};${fontSizeStyle}">
            ${block.content}
          </div>
`;
}).join('') : ''}
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
    };
    
    syncAndExport(actualExport);
  }, [localSlides, syncAndExport]);

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
                {fullscreenSlide.textBlocks!.map((block, idx) => {
                  const fontSize = block.customFontSize || getFontSizePx(block.size);
                  const color = block.customColor || block.color || "#333333";
                  return (
                    <div
                      key={idx}
                      className="absolute"
                      style={{
                        left: `${block.x_percent}%`,
                        top: `${block.y_percent}%`,
                        width: `${block.width_percent}%`,
                        transform: "translate(-50%, -50%)",
                        fontSize: `${fontSize}px`,
                        color: color,
                        textAlign: block.align as "left" | "center" | "right" || "center",
                        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
                        fontWeight: block.size === "large" ? 600 : 400,
                        lineHeight: 1.3,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {block.content}
                    </div>
                  );
                })}
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
      <div className="mb-4">
        <h2 className="text-2xl font-semibold mb-2">展示并编辑幻灯片</h2>
        <p className="text-white/60">
          {hasEditableText 
            ? "拖拽移动文字块 · 双击编辑内容 · 全屏演示或下载"
            : "全屏演示或下载 · 返回第 3 步提取可编辑文字"
          }
        </p>
        {hasEditableText && (
          <p className="text-purple-400 text-sm mt-1 flex items-center gap-1">
            <EditIcon className="w-4 h-4" />
            此页已提取 {currentSlide.textBlocks!.length} 个可编辑文字块
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3 p-3 bg-white/5 rounded-lg flex-wrap">
        {/* Undo button */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors ${
            canUndo 
              ? 'bg-white/10 hover:bg-white/20' 
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="撤销 (Ctrl+Z)"
        >
          ↶ 撤销
        </button>

        {/* Add text button */}
        <button
          onClick={addNewTextBlock}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded transition-colors"
          title="添加文字"
        >
          T+ 添加文字
        </button>

        {/* Add image button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded transition-colors"
          title="添加图片（或拖拽到幻灯片）"
        >
          🖼️ 添加图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addImageFromFile(file);
            e.target.value = '';
          }}
        />

        {/* Overlay controls - show when slide has editable content */}
        {hasEditableText && (
          <>
            <div className="w-px h-6 bg-white/20" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOriginalOverlay}
                onChange={(e) => setShowOriginalOverlay(e.target.checked)}
                className="w-4 h-4 rounded accent-accent-blue"
              />
              <span className="text-sm">叠加原图</span>
            </label>
            {showOriginalOverlay && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">透明度</span>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
                  className="w-24 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent-blue"
                />
                <span className="text-xs text-white/80 w-6">{overlayOpacity}%</span>
              </div>
            )}
          </>
        )}

        {/* Text block controls - inline */}
        {editMode && hasEditableText && (
          <InlineTextBlockControls
            selectedBlocks={selectedBlocks}
            onUpdateFontSize={batchUpdateFontSize}
            onUpdateColor={batchUpdateColor}
            onDelete={deleteSelectedBlocks}
            onSelectAll={selectAllBlocks}
            totalBlocks={currentSlide.textBlocks?.length || 0}
          />
        )}

        {/* Selected images info */}
        {selectedImageIndices.length > 0 && (
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <span className="text-xs text-white/60">已选 {selectedImageIndices.length} 个图片</span>
            <button
              onClick={deleteSelectedBlocks}
              className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition-colors"
            >
              🗑️ 删除
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Preview Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Current slide preview with editable text */}
          <div 
            ref={previewContainerRef}
            className={`flex-1 bg-black rounded-xl overflow-hidden relative min-h-0 ${
              isDragOver ? 'ring-2 ring-accent-blue ring-inset' : ''
            }`}
            onClick={handleContainerClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Drag overlay hint */}
            {isDragOver && (
              <div className="absolute inset-0 bg-accent-blue/20 z-50 flex items-center justify-center pointer-events-none">
                <div className="text-white text-lg font-medium bg-black/50 px-6 py-3 rounded-lg">
                  松开以添加图片
                </div>
              </div>
            )}

            {currentSlide && (
              <>
                {/* Base layer: Clean image (or original if not editable) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getDisplayUrl(currentSlide, editMode)}
                  alt={`Slide ${currentSlide.number}`}
                  className="w-full h-full object-contain"
                />
                
                {/* Editable text blocks layer */}
                {editMode && hasEditableText && (
                  <div className="absolute inset-0">
                    {currentSlide.textBlocks!.map((block, blockIndex) => (
                      <DraggableTextBlock
                        key={blockIndex}
                        block={block}
                        blockIndex={blockIndex}
                        isSelected={selectedBlockIndices.includes(blockIndex)}
                        onSelect={(e) => handleBlockSelect(blockIndex, e)}
                        onUpdateContent={(content) => updateTextBlockContent(currentSlideIndex, blockIndex, content)}
                        onUpdatePosition={(x, y) => updateTextBlockPosition(currentSlideIndex, blockIndex, x, y)}
                        containerRef={previewContainerRef}
                      />
                    ))}
                  </div>
                )}

                {/* User-added images layer */}
                {editMode && hasImages && (
                  <div className="absolute inset-0">
                    {currentSlide.imageBlocks!.map((image, imageIndex) => (
                      <ResizableImageBlock
                        key={image.id}
                        image={image}
                        isSelected={selectedImageIndices.includes(imageIndex)}
                        onSelect={(e) => handleImageSelect(imageIndex, e)}
                        onUpdatePosition={(x, y) => updateImagePosition(imageIndex, x, y)}
                        onUpdateSize={(width) => updateImageSize(imageIndex, width)}
                        containerRef={previewContainerRef}
                      />
                    ))}
                  </div>
                )}

                {/* Original image overlay for comparison */}
                {editMode && hasEditableText && showOriginalOverlay && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ opacity: overlayOpacity / 100 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentSlide.enlarged || currentSlide.path}
                      alt="Original for comparison"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </>
            )}
            
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
              <span className="bg-black/50 px-3 py-1.5 rounded-lg text-sm pointer-events-auto">
                第 {currentSlideIndex + 1} 页 / 共 {slides.length} 页
                {currentSlide?.enlarged && (
                  <span className="ml-2 text-green-400">4K</span>
                )}
                {hasEditableText && (
                  <span className="ml-2 text-purple-400">可编辑</span>
                )}
              </span>
              <div className="flex gap-2 pointer-events-auto">
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
