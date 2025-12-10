// Parse the outline_visual.md format to extract slide information
// This mirrors the logic in tools/generate_slides.py

import { resolveAssetUrl } from "./asset-mapping";

export interface ParsedSlide {
  number: number;
  title: string;
  content: string;
  assetPaths: string[];
  uploadUrl?: string; // If present, use this image directly instead of AI generation
}

export function parseOutline(
  content: string,
  startSlide: number = 1,
  endSlide: number = 99,
  specificSlides?: number[]
): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  
  // Regex to find slide blocks: #### Slide X: Title
  const slidePattern = /#### Slide (\d+):(.*?)(?=#### Slide \d+:|$)/gs;
  
  let match;
  while ((match = slidePattern.exec(content)) !== null) {
    const slideNum = parseInt(match[1], 10);
    
    // Check constraints
    if (specificSlides && !specificSlides.includes(slideNum)) {
      continue;
    }
    if (!specificSlides && (slideNum < startSlide || slideNum > endSlide)) {
      continue;
    }
    
    const slideContent = match[0].trim();
    const title = match[2].trim();
    
    // Check for Upload URL (use existing image instead of AI generation)
    let uploadUrl: string | undefined;
    const uploadMatch = slideContent.match(/\*\s+\*\*Upload\*\*:\s*(.+)/);
    if (uploadMatch) {
      const urlOrShortName = uploadMatch[1].trim();
      if (urlOrShortName && urlOrShortName.toLowerCase() !== "none") {
        // 解析短名称（@filename）或完整 URL
        uploadUrl = resolveAssetUrl(urlOrShortName);
      }
    }
    
    // Extract asset paths
    const assetPaths: string[] = [];
    
    // Find the Asset section
    const assetHeaderMatch = slideContent.match(/\*\s+\*\*Asset\*\*?\s*:?/);
    
    if (assetHeaderMatch && assetHeaderMatch.index !== undefined) {
      const restOfSection = slideContent.slice(assetHeaderMatch.index + assetHeaderMatch[0].length);
      const lines = restOfSection.split("\n");
      
      // Check the first line (content on same line as **Asset**:)
      const currentLine = lines[0].trim();
      if (currentLine && currentLine.toLowerCase() !== "none") {
        assetPaths.push(currentLine);
      }
      
      // Process subsequent lines looking for bullet points
      for (let i = 1; i < lines.length; i++) {
        const stripped = lines[i].trim();
        if (!stripped) continue;
        
        // Stop if we hit a new major section
        if (/^\*\s+\*\*/.test(stripped) && !stripped.startsWith("* **Asset")) {
          break;
        }
        
        // Check for list items
        if (stripped.startsWith("* ") || stripped.startsWith("- ")) {
          const val = stripped.slice(2).trim();
          if (val.toLowerCase() !== "none") {
            assetPaths.push(val);
          }
        }
      }
    }
    
    slides.push({
      number: slideNum,
      title,
      content: slideContent,
      assetPaths,
      uploadUrl,
    });
  }
  
  return slides.sort((a, b) => a.number - b.number);
}

// Extract the prompt section from slide content
export function extractPrompt(slideContent: string): string {
  const promptMatch = slideContent.match(/\*\*Prompt\*\*:\s*([\s\S]*?)(?=\*\s+\*\*|\n\*\s+\*\*|$)/);
  if (promptMatch) {
    return promptMatch[1].trim();
  }
  return "";
}

// Get slide count from outline
export function getSlideCount(content: string): number {
  const matches = content.match(/#### Slide \d+:/g);
  return matches ? matches.length : 0;
}


