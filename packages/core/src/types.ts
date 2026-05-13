export type JobStatus = 
  | 'pending'    // Waiting to be processed
  | 'running'    // Currently being executed
  | 'completed'  // Finished successfully
  | 'failed'     // Finished with error
  | 'delayed'    // Scheduled for later
  | 'cancelled'; // Cancelled by user

  export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// Priority order (for sorting):
export const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 0,  // Runs first
  high: 1,
  normal: 2,
  low: 3,       // Runs last
};

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

export interface RetryOptions {
  strategy: BackoffStrategy;  // How to calculate wait: fixed, linear, exponential
  delay: number;              // Base delay in milliseconds
  maxDelay?: number;          // Cap the delay (e.g., max 30 seconds)
}

export interface Job<T = unknown> {
  // Identity
  id:string;
  name: string;

  // The work
  data: T;

  // Lifecycle
  status: JobStatus;

  // Configuration
  priority: JobPriority;
  maxAttempts: number;
  delay: number;
  timeout: number

  // Retry tracking
  attempts: number;
  retryOptions?: RetryOptions;

  // Timing (all in ms)
  createdAt: number;
  startedAt?: number;
  completedAt?: number;

  // Results
  progress: number; // percentage
  error?: string;
  result?: unknown;

  // Organization
  tags: string[]; // for filtering
  metadata: Record<string, unknown>; // any extra data
}

export type TaskFunction<T = unknown, TResult = unknown> = (job: Job<T>) => Promise<TResult>;

export interface JobOptions {
  name?: string;
  priority?: JobPriority;
  data?: unknown;
  delay?: number;
  timeout?: number;
  maxAttempts?: number;
  retryOptions?: RetryOptions;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface QueueOptions {
  concurrency?: number; // default: 5
  defaultJobOptions?: JobOptions;
  autoStart?: boolean; // default: true
  maxQueuedJobs?: number;
}

export interface QueueState {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  // cancelled: number;
  total: number;
}

export type QueueEvent =
  | 'job:added'       // New job created
  | 'job:started'     // Job began executing
  | 'job:completed'   // Job finished successfully
  | 'job:failed'      // Job threw an error
  | 'job:progress'    // Job reported progress
  | 'job:retry'       // Job is being retried
  | 'queue:drain'     // All jobs finished
  | 'queue:paused'    // Queue was paused
  | 'queue:resumed';  // Queue was resumed

// Type-safe event payloads
export interface EventPayload {
  'job:added': { job: Job };
  'job:started': { job: Job };
  'job:completed': { job: Job; result: unknown; duration: number };
  'job:failed': { job: Job; error: Error; duration: number };
  'job:progress': { job: Job; progress: number };
  'job:retry': { job: Job; attempt: number; nextRetryIn: number };
  'queue:drain': { stats: QueueState };
  'queue:paused': {};
  'queue:resumed': {};
}

// Progress reporting
export interface ProgressReporter {
  (progress: number): void;
}

// Schedule jobs
export interface ScheduleJobs {
  type: 'once' | 'repeat';
  delay?: number; // ms
  cron?: string;
  timezone?: string;
}

// Storage adaptor
export interface StorageAdapter {
  // Save a new job to storage 
  saveJob(job: Job): Promise<void>;
  
  // Get a job by ID  
  getJob(jobId: string): Promise<Job | null>;
  
  // Update specific fields of a job  
  updateJob(jobId: string, updates: Partial<Job>): Promise<void>;
  
  // Remove a job from storage  
  deleteJob(jobId: string): Promise<void>;
  
  // List jobs, optionally filtered by status  
  listJobs(status?: JobStatus): Promise<Job[]>;
  
  // Remove all jobs (for testing/reset)  
  clearAll(): Promise<void>;
  
  // Close the storage connection gracefully  
  close(): Promise<void>;
}

// Custom errors
export class QueueError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QueueError';
  }
}

export class JobTimeoutError extends QueueError {
  constructor(jobId: string, timeout: number) {
    super(
      `Job ${jobId} timed out after ${timeout}ms`,
      'JOB_TIMEOUT'
    );
    this.name = 'JobTimeoutError';
  }
}

export class QueueFullError extends QueueError {
  constructor(maxJobs: number) {
    super(
      `Queue is full. Maximum ${maxJobs} jobs allowed.`,
      'QUEUE_FULL'
    );
    this.name = 'QueueFullError';
  }
}