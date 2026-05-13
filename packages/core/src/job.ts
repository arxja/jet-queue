import type { Job, JobStatus, RetryOptions } from './types';

/**
 * Internal representation of a job with its task function
 */
export interface InternalJob<T = unknown> extends Job<T> {
  _taskFn?: (job: Job<T>) => Promise<unknown>;
  _retryOptions?: RetryOptions;
  _resolve?: (value: unknown) => void;
  _reject?: (error: Error) => void;
  _handlerName?: string;
  _onProgress?: (job: Job, progress: number) => void;
}

/**
 * Create a new job object with defaults
 */
export function createJob<T = unknown>(
  id: string,
  name: string,
  taskFnOrHandlerName: ((job: Job<T>) => Promise<unknown>) | string,
  options: {
    data?: T;
    priority?: "low" | "normal" | "high" | "critical";
    timeout?: number;
    maxAttempts?: number;
    delay?: number;
    retryOptions?: RetryOptions;
    tags?: string[];
    metadata?: Record<string, unknown>;
    onProgress?: (job: Job, progress: number) => void;
  } = {},
): InternalJob<T> {
  const isFunction = typeof taskFnOrHandlerName === "function";
  return {
    // Identity
    id,
    name,
    data: options.data as T,

    // Lifecycle
    status: "pending",

    // Configuration
    priority: options.priority || "normal",
    maxAttempts: options.maxAttempts || 1,
    timeout: options.timeout || 30000, // 30 seconds default
    delay: options.delay || 0,

    // Tracking
    attempts: 0,
    progress: 0,

    // Timing
    createdAt: Date.now(),

    // Organization
    tags: options.tags || [],
    metadata: options.metadata || {},

    // Internal (not part of public Job type)
    _taskFn: isFunction ? taskFnOrHandlerName : undefined,
    _handlerName: !isFunction ? taskFnOrHandlerName : undefined,
    _retryOptions: options.retryOptions,
    _onProgress: options.onProgress,
  };
}

/**
 * Calculate the delay before next retry based on strategy
 * 
 * Examples (base delay = 1000ms):
 *   fixed:       1000, 1000, 1000, 1000
 *   linear:      1000, 2000, 3000, 4000
 *   exponential: 1000, 2000, 4000, 8000
 */
export function calculateRetryDelay(
    attempt: number,
    options: RetryOptions
  ): number {
  let delay: number 
  switch (options.strategy) {
    case 'fixed':
      delay = options.delay;
      break;
    case 'linear':
      delay = options.delay * attempt;
      break;
    case 'exponential':
      delay = options.delay * Math.pow(2, attempt - 1);
      break;
    default:
      delay = options.delay;
  }
  // Cap the delay if maxDelay is set
  if (options.maxDelay && delay > options.maxDelay) {
    delay = options.maxDelay;
  }

  return delay;
}

/**
 * Check if job has exceeded its timeout
 */
export function isJobTimedOut(job: InternalJob): boolean {
  if (!job.startedAt) return false;
  const elapsed = Date.now() - job.startedAt;
  return elapsed > job.timeout;
}

/**
 * Get human-readable job summary
 */
export function jobToString(job: InternalJob): string {
  return `[${job.status.toUpperCase()}] ${job.name} (${job.id}) - attempts: ${job.attempts}/${job.maxAttempts}`;
}

/**
 * Create a progress reporter for a job
 * 
 * Usage inside a task:
 *   queue.add(async (job) => {
 *     const reportProgress = createProgressReporter(job);
 *     
 *     for (let i = 0; i < 100; i++) {
 *       await processChunk();
 *       reportProgress(i + 1); // "40% done!"
 *     }
 *   });
 */
export function createProgressReporter(
  job: InternalJob,
  onProgress: (job: InternalJob, progress?: number) => void
): (progress: number) => void {
  return (progress: number) => {
    // Clamp between 0-100
    job.progress = Math.max(0, Math.min(100, Math.round(progress)));
    
    // Call the callback if provided
    onProgress?.(job, job.progress);
  }
}