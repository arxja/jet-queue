import type {
  Job,
  JobPriority,
  JobOptions,
  QueueOptions,
  QueueState,
  QueueEvent,
  TaskFunction,
} from './types';
import { QueueError, JobTimeoutError, QueueFullError, PRIORITY_ORDER } from './types';
import { EventEmitter } from './events';
import { Logger } from './utils/logger';
import { generateJobId } from './utils/uid';
import {
  type InternalJob,
  createJob,
  calculateRetryDelay,
} from './job';

export class TaskQueue {
  // Configuration
  private concurrency: number;
  private maxQueuedJobs: number;
  private autoStart: boolean;
  private defaultJobOptions: JobOptions;

  // State 
  private pending: InternalJob[] = [];
  private running: Map<string, InternalJob> = new Map();
  private delayed: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Counters
  private completedCount = 0;
  private failedCount = 0;
  private isPaused = false;
  private isShuttingDown = false;

  // System
  private events: EventEmitter;
  private logger: Logger;

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency ?? 5;
    this.maxQueuedJobs = options.maxQueuedJobs ?? Infinity;
    this.autoStart = options.autoStart !== false; // Default: true
    this.defaultJobOptions = options.defaultJobOptions || {};
    
    this.events = new EventEmitter();
    this.logger = new Logger('info');

    // Don't auto-start if requested
    if (!this.autoStart) {
      this.isPaused = true;
    }

    this.logger.info(
      `Queue created (concurrency: ${this.concurrency}, autoStart: ${this.autoStart})`
    );
  }

  // PUBLIC API: ADDING JOBS

  /**
   * Add a job to the queue
   * 
   * @param taskFn - The async function to execute
   * @param options - Job configuration (priority, retries, etc.)
   * @returns The job ID (use this to track the job)
   * 
   * Example:
   *   const jobId = queue.add(
   *     async (job) => {
   *       await sendEmail(job.data.email);
   *       return { sent: true };
   *     },
   *     { name: 'send-welcome-email', priority: 'high' }
   *   );
   */
  add<T = unknown>(
    taskFn: TaskFunction<T>,
    options: JobOptions = {}
  ): string {
    // Safety checks
    if (this.isShuttingDown) {
      throw new QueueError(
        'Cannot add job during shutdown',
        'SHUTTING_DOWN'
      );
    }
    if (this.pending.length >= this.maxQueuedJobs) {
      throw new QueueFullError(this.maxQueuedJobs);
    }

    // Merge with defaults
    const mergedOptions = { ...this.defaultJobOptions, ...options };
    
    // Create the job
    const jobId = generateJobId();
    const job = createJob(
      jobId,
      mergedOptions.name || 'unnamed',
      taskFn,
      {
        priority: mergedOptions.priority,
        timeout: mergedOptions.timeout,
        maxAttempts: mergedOptions.maxAttempts,
        delay: mergedOptions.delay,
        retryOptions: mergedOptions.retryOptions,
        tags: mergedOptions.tags,
        metadata: mergedOptions.metadata,
      }
    );

    // Handle delayed jobs (run later)
    if (job.delay > 0) {
      job.status = 'delayed';
      this.scheduleDelayedJob(job);
    } else {
      // Add to pending queue (sorted by priority)
      this.enqueueByPriority(job);
    }

     // Notify listeners
    this.events.emit('job:added', { job });

    this.logger.debug(
      `Job added: ${job.name} (${job.id}) [${job.status}]`
    );

    // Start processing if not paused
    if (!this.isPaused) {
      this.processNext();
    }

    return jobId;
  }

  /**
   * Pause the queue
   * Running jobs continue, but no new jobs start
   */
  pause(): void {
    this.isPaused = true;
    this.logger.info('Queue paused');
    this.events.emit('queue:paused', {});
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    this.logger.info('Queue resumed');
    this.events.emit('queue:resumed', {});
    this.processNext();
  }

  /**
   * Get a specific job by ID
   */
  getJob(jobId: string): Job | null {
    // Check running
    const running = this.running.get(jobId);
    if (running) return running;

    // Check pending
    const pending = this.pending.find(j => j.id === jobId);
    if (pending) return pending;

    return null;
  }

  /**
   * Listen for events
   */
  on<T extends QueueEvent>(
    event: T,
    callback: (payload: any) => void
  ): void {
    this.events.on(event, callback);
  }

  /**
   * Listen once for an event
   */
  once<T extends QueueEvent>(
    event: T,
    callback: (payload: any) => void
  ): void {
    this.events.once(event, callback);
  }

  /**
   * Gracefully shutdown the queue
   * - Stop accepting new jobs
   * - Wait for running jobs to finish (with timeout)
   * - Clear delayed jobs
   */
  async shutdown(gracePeriodMs = 5000): Promise<void> {
    this.isShuttingDown = true;
    this.isPaused = true;

    this.logger.info('Shutting down...');

    // Clear delayed jobs
    this.delayed.forEach(timeout => clearTimeout(timeout));
    this.delayed.clear();

    // Wait for running jobs (with grace period)
    if (this.running.size > 0) {
      this.logger.info(`Waiting for ${this.running.size} running jobs...`);
      
      const start = Date.now();
      while (this.running.size > 0 && (Date.now() - start) < gracePeriodMs) {
        await new Promise(r => setTimeout(r, 100));
      }

      if (this.running.size > 0) {
        this.logger.warn(`Shutdown with ${this.running.size} jobs still running`);
      }
    }

    this.logger.info('Shutdown complete');
  }

  /**
   * Cancel a pending or delayed job
   */
  cancel(jobId: string): boolean {
    // Check pending
    const index = this.pending.findIndex(j => j.id === jobId);
    if (index !== -1) {
      const job = this.pending[index];
      this.pending.splice(index, 1);
      job.status = 'cancelled';
      // ! this.events.emit('job:completed', { job, result: null, duration: 0 });
      return true;
    }

    // Check delayed
    const timeout = this.delayed.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.delayed.delete(jobId);
      return true;
    }

    return false;
  }

  /**
   * Get current queue statistics
   */
  getState(): QueueState {
    return {
      pending: this.pending.length,
      running: this.running.size,
      completed: this.completedCount,
      failed: this.failedCount,
      delayed: this.delayed.size,
      total: this.pending.length +
              this.running.size +
              this.completedCount +
              this.failedCount +
              this.delayed.size,
    };
  }


  // INTERNAL: JOB MANAGEMENT

    /**
   * Insert job into pending queue at correct priority position
   * 
   * Priority queue works like a hospital ER (at least it should be like this):
   * - Critical patients (critical) seen first
   * - Then serious cases (high)
   * - Then regular checkups (normal)
   * - Then paperwork (low)
   * 
   * find where the new job belongs and insert it there.
   */
  private enqueueByPriority(job: InternalJob): void {
    const insertIndex = this.pending.findIndex(
      existing => PRIORITY_ORDER[job.priority] < PRIORITY_ORDER[existing.priority]
    );

    if (insertIndex === -1) {
      // Lowest priority so far, add to end
      this.pending.push(job);
    } else {
      // Insert at the right position
      this.pending.splice(insertIndex, 0, job);
    }
  }

  /**
   * Schedule a job to run after a delay
   */
  private scheduleDelayedJob(job: InternalJob): void {
    const timeout = setTimeout(() => {
      this.delayed.delete(job.id);
      
      if (job.status === 'delayed') {
        job.status = 'pending';
        this.enqueueByPriority(job);
        this.processNext();
      }
    }, job.delay);
    this.delayed.set(job.id, timeout);
  }

    /**
   * Main processing loop
   * 
   * This is the heart of the queue.
   * It checks: "Can we run more jobs?"
   * If yes, takes the highest priority job and runs it.
   * Repeats until either:
   * - Nothing left to run, or
   * - Hit the concurrency limit
   */
  private processNext(): void {
    // Don't process if paused or shutting down
    if (this.isPaused || this.isShuttingDown) {
      return;
    }

    while (
      this.running.size < this.concurrency &&
      this.pending.length > 0
    ) {
      const job = this.pending.shift();
      if (job && job.status !== 'cancelled') {
        this.executeJob(job);
      }
    }

    // Emit drain event if everything is done
    if (
      this.pending.length === 0 &&
      this.running.size === 0 &&
      this.delayed.size === 0
    ) {
      this.events.emit('queue:drain', {
        stats: this.getState(),
      });
    }
  }

  /**
   * Execute a single job
   * 
   * This is where a job goes from "pending" to "running"
   * and eventually "completed" or "failed"
   */
  private async executeJob(job: InternalJob): Promise<void> {
    // Track that we're running this job
    job.status = 'running';
    job.startedAt = Date.now();
    job.attempts++;
    this.running.set(job.id, job);

    this.logger.debug(`Job started: ${job.name} (${job.id})`);
    this.events.emit('job:started', { job });

    try {
      // EXECUTE THE TASK (with timeout)
      const result = await this.executeWithTimeout(job, job._taskFn);

      // SUCCESS
      job.status = 'completed';
      job.completedAt = Date.now();
      this.completedCount++;

      const duration = job.completedAt - job.startedAt!;

      this.logger.debug(
        `Job completed: ${job.name} (${job.id}) in ${duration}ms`
      );

      this.events.emit('job:completed', {
        job,
        result,
        duration,
      });

      // Resolve the promise if someone is awaiting this job
      job._resolve?.(result);
    } catch (error) {
      // FAILURE
      this.handleJobFailure(job, error as Error);
    } finally {
      // Clean up - job is no longer running (can be deleted here or be canceled)
      this.running.delete(job.id);
      
      // Process next job if any
      this.processNext();
    }
  }

  /**
   * Execute a task with timeout protection
   * 
   * If the task takes too long, we kill it.
   * This prevents one slow job from blocking others forever.
   */
  private async executeWithTimeout(
    job: InternalJob,
    taskFn: (job: InternalJob) => Promise<unknown>
  ): Promise<unknown> {
    if (job.timeout <= 0) {
      // No timeout set, just run normally
      return taskFn(job);
    }

    // Create a timeout promise that rejects after the time limit
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new JobTimeoutError(job.id, job.timeout));
      }, job.timeout);
    });

    // Race the task against the timeout
    // Whichever finishes first wins
    return Promise.race([taskFn(job), timeoutPromise]);
  }

  /**
   * Handle a failed job
   * 
   * Decisions:
   * 1. Should we retry? (check attempts vs maxAttempts)
   * 2. If retry: how long to wait? (calculate backoff)
   * 3. If no retry: mark as failed permanently
   */
  private handleJobFailure(job: InternalJob, error: Error): void {
    const duration = Date.now() - job.startedAt!;

    this.logger.warn(
      `Job failed: ${job.name} (${job.id}) - ${error.message}`
    );

    // Check if we should retry
    if (job.attempts < job.maxAttempts && job._retryOptions) {
      // Calculate how long to wait before retry
      const retryDelay = calculateRetryDelay(
        job.attempts,
        job._retryOptions
      );

      this.logger.info(
        `Retrying job ${job.id} in ${retryDelay}ms (attempt ${job.attempts + 1}/${job.maxAttempts})`
      );

      this.events.emit('job:retry', {
        job,
        attempt: job.attempts + 1,
        nextRetryIn: retryDelay,
      });

      // Schedule the retry
      job.status = 'pending';
      job.error = error.message;

      setTimeout(() => {
        this.enqueueByPriority(job);
        this.processNext();
      }, retryDelay);
    } else {
      // No more retries - permanent failure
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = error.message;
      this.failedCount++;

      this.events.emit('job:failed', {
        job,
        error,
        duration,
      });

      // Reject the promise if someone is awaiting this job
      job._reject?.(error);
    }
  }
}