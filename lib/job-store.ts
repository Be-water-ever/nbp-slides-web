// In-memory job store for tracking generation tasks
// In production, use Redis or a database

export interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  totalSlides: number;
  completedSlides: number;
  slides: string[]; // Array of generated slide image paths
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Use global object to persist jobs across hot reloads in development
// This prevents losing job state when Next.js recompiles modules
declare global {
  // eslint-disable-next-line no-var
  var __jobStore: Map<string, Job> | undefined;
}

// Initialize or reuse existing store
const jobs = global.__jobStore || new Map<string, Job>();

// Persist to global in development
if (process.env.NODE_ENV !== "production") {
  global.__jobStore = jobs;
}

export function createJob(totalSlides: number): Job {
  const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const job: Job = {
    id,
    status: "pending",
    progress: 0,
    totalSlides,
    completedSlides: 0,
    slides: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  
  const updatedJob = {
    ...job,
    ...updates,
    updatedAt: new Date(),
  };
  jobs.set(id, updatedJob);
  return updatedJob;
}

export function deleteJob(id: string): boolean {
  return jobs.delete(id);
}

export function addSlideToJob(id: string, slidePath: string): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  
  const completedSlides = job.completedSlides + 1;
  const progress = Math.round((completedSlides / job.totalSlides) * 100);
  
  return updateJob(id, {
    slides: [...job.slides, slidePath],
    completedSlides,
    progress,
    status: completedSlides >= job.totalSlides ? "completed" : "processing",
  });
}

// Clean up old jobs (older than 1 hour)
export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < oneHourAgo) {
      jobs.delete(id);
    }
  }
}

// Run cleanup every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldJobs, 10 * 60 * 1000);
}

