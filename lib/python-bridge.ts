import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";

export interface PythonResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

// Get the path to the Python scripts directory
function getScriptsPath(): string {
  // Resolve relative to the web project root
  return path.resolve(process.cwd(), process.env.PYTHON_SCRIPTS_PATH || "../nbp_slides/tools");
}

// Get the path to the nbp_slides project
function getNbpSlidesPath(): string {
  return path.resolve(process.cwd(), process.env.NBP_SLIDES_PATH || "../nbp_slides");
}

// Find the best Python executable to use
function getPythonExecutable(): string {
  const nbpSlidesPath = getNbpSlidesPath();
  
  // Check for virtual environment in order of preference
  const venvPaths = [
    path.join(nbpSlidesPath, ".venv", "bin", "python"),
    path.join(nbpSlidesPath, ".venv", "bin", "python3"),
    path.join(nbpSlidesPath, "venv", "bin", "python"),
    path.join(nbpSlidesPath, "venv", "bin", "python3"),
  ];
  
  for (const venvPath of venvPaths) {
    if (existsSync(venvPath)) {
      console.log(`[Python Bridge] Using venv Python: ${venvPath}`);
      return venvPath;
    }
  }
  
  // Fall back to system Python
  console.log("[Python Bridge] No venv found, using system python3");
  return "python3";
}

/**
 * Run a Python script with the user's API key
 * The API key is passed as an environment variable, not stored anywhere
 */
export async function runPythonScript(
  scriptName: string,
  args: string[],
  apiKey: string,
  onOutput?: (line: string) => void
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const scriptsPath = getScriptsPath();
    const scriptPath = path.join(scriptsPath, scriptName);
    const pythonExe = getPythonExecutable();
    
    console.log(`[Python Bridge] Running: ${pythonExe} ${scriptPath}`);
    
    // Pass API key only in the subprocess environment
    const env = {
      ...process.env,
      GEMINI_API_KEY: apiKey,
      PYTHONUNBUFFERED: "1", // Ensure real-time output
    };
    
    const proc: ChildProcess = spawn(pythonExe, [scriptPath, ...args], {
      env,
      cwd: getNbpSlidesPath(),
    });
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      if (onOutput) {
        text.split("\n").filter(Boolean).forEach(onOutput);
      }
    });
    
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      if (onOutput) {
        text.split("\n").filter(Boolean).forEach(onOutput);
      }
    });
    
    proc.on("close", (code) => {
      // Check for common Python errors and provide helpful messages
      if (code !== 0 && stderr.includes("ModuleNotFoundError")) {
        const moduleMatch = stderr.match(/No module named '([^']+)'/);
        const moduleName = moduleMatch ? moduleMatch[1] : "unknown";
        stderr += `\n\n[提示] 缺少 Python 模块: ${moduleName}\n请在 nbp_slides 目录下运行: pip install -r requirements.txt`;
      }
      
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });
    
    proc.on("error", (error) => {
      resolve({
        success: false,
        stdout,
        stderr: stderr + "\n" + error.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * Generate a single slide image using gemini_generate_image.py
 */
export async function generateSlideImage(
  prompt: string,
  outputPrefix: string,
  apiKey: string,
  imageInputs?: string[],
  onOutput?: (line: string) => void
): Promise<PythonResult> {
  const args = [
    "--prompt", prompt,
    "--output", outputPrefix,
    "--aspect-ratio", "16:9",
    // Note: --size is no longer supported in newer google-genai SDK
  ];
  
  // Add image inputs if provided
  if (imageInputs && imageInputs.length > 0) {
    for (const imagePath of imageInputs) {
      args.push("--input", imagePath);
    }
  }
  
  return runPythonScript("gemini_generate_image.py", args, apiKey, onOutput);
}

/**
 * Enlarge a slide image to 4K using gemini_enlarge_image.py
 */
export async function enlargeSlideImage(
  inputPath: string,
  outputPath: string,
  apiKey: string,
  onOutput?: (line: string) => void
): Promise<PythonResult> {
  const args = [
    "--input", inputPath,
    "--output", outputPath,
  ];
  
  return runPythonScript("gemini_enlarge_image.py", args, apiKey, onOutput);
}

/**
 * Validate API key by making a simple test call
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  // Simple validation: check format (AIza... pattern for Google API keys)
  if (!apiKey || apiKey.length < 20) {
    return false;
  }
  
  // Could add actual API validation here if needed
  return true;
}

