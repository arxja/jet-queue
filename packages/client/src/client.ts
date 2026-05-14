import type {
  AddJobOptions,
  JobResponse,
  StatsResponse,
  HealthResponse,
  ClientOptions,
} from "./types";

export class queueClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Create a new client
   *
   * @param options.baseUrl - server URL
   *
   * Example:
   *   const client = new queueClient({ baseUrl: 'http://localhost:3001' });
   */
  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    if (options.retry) {
      this.maxReconnectAttempts = options.retry.maxRetries;
      this.maxReconnectAttempts = options.retry.maxRetries;
    }
  }

  // Internal helpers
  /**
   * Handles:
   * - JSON serialization/deserialization
   * - Error status codes
   * - Network errors
   */
  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = (await response.json()) as { error?: string; code?: string };

      if (!response.ok) {
        throw new QueueError(
          data.error || "Request failed",
          data.code || "UNKNOWN_ERROR",
          response.status,
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof QueueError) {
        throw error;
      }

      // Wrap network errors
      throw new QueueError(
        `Failed to connect to job-queue-system server at ${this.baseUrl}`,
        "CONNECTION_ERROR",
        0,
      );
    }
  }

  // Public Api: jobs

  /**
   * Add a new job to the queue
   *
   * @param handler - The registered handler name on the server
   * @param options - Job configuration (priority, delay, etc.)
   * @returns The created job with its ID
   *
   * Example:
   *   const job = await client.addJob('send-email', {
   *     data: { to: 'user@test.com' },
   *     priority: 'high',
   *   });
   *   console.log(job.id); // 'job_abc123'
   */
  async addJob(
    handler: string,
    options: AddJobOptions = {},
  ): Promise<JobResponse> {
    return this.request<JobResponse>("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        handler,
        data: options.data,
        priority: options.priority,
        delay: options.delay,
        timeout: options.timeout,
        maxAttempts: options.maxAttempts,
        retryStrategy: options.retryStrategy,
        retryDelay: options.retryDelay,
        tags: options.tags,
      }),
    });
  }

  /**
   * Get a job's current status and details
   *
   * @param jobId - The job ID returned from addJob()
   * @returns Full job information
   *
   * Example:
   *   const job = await client.getJob('job_abc123');
   *   if (job.status === 'completed') {
   *     console.log('Done!', job.result);
   *   }
   */
  async getJob(jobId: string): Promise<JobResponse> {
    return this.request<JobResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
  }

  /**
   * Get only a job's progress (0-100)
   * Faster than getJob() because it returns less data
   *
   * Example:
   *   const { progress } = await client.getJobProgress('job_abc123');
   *   updateProgressBar(progress); // 45
   */
  async getJobProgress(
    jobId: string,
  ): Promise<{ id: string; status: string; progress: number }> {
    return this.request(`/api/jobs/${encodeURIComponent(jobId)}/progress`);
  }

  /**
   * Cancel a pending or delayed job
   * Cannot cancel already running jobs
   *
   * Example:
   *   await client.cancelJob('job_abc123');
   */
  async cancelJob(jobId: string): Promise<{ id: string; status: string }> {
    return this.request(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  }

  /**
   * Manually retry a failed job
   *
   * Example:
   *   await client.retryJob('job_abc123');
   */
  async retryJob(
    jobId: string,
  ): Promise<{ id: string; status: string; message: string }> {
    return this.request(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: "POST",
    });
  }

  // Public Api: Stats and Health

  /**
   * Get queue statistics
   *
   * Example:
   *   const stats = await client.getStats();
   *   console.log(`${stats.pending} jobs waiting`);
   */
  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>("/api/queues/stats");
  }

  /**
   * Check if the server is healthy
   *
   * Example:
   *   const health = await client.health();
   *   if (health.status === 'healthy') {
   *     console.log('Server is up!');
   *   }
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health");
  }

  // Public Api: Websocket

  /**
   * Connect to the server's WebSocket for real-time events
   * Call this once when your app starts
   *
   * Example:
   *   client.connect();
   *   client.onJobCompleted('job_abc', (job) => {
   *     console.log('Job done!', job.result);
   *   });
   */
  connect(): void {
    if (this.ws) return; // Already connected

    const wsUrl = this.baseUrl.replace("http", "ws");
    this.ws = new WebSocket(`${wsUrl}/ws`);

    this.ws.onopen = () => {
      console.log("[job-queue-system SDK] Connected to server");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("[job-queue-system SDK] Failed to parse message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("[job-queue-system SDK] Disconnected");
      this.ws = null;
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[job-queue-system SDK] WebSocket error:", error);
    };
  }

  /**
   * Listen for a specific job completing
   *
   * @param jobId - The job to watch
   * @param callback - Called when the job completes
   *
   * Example:
   *   const job = await client.addJob('send-email', { data: {...} });
   *
   *   client.onJobCompleted(job.id, (completedJob) => {
   *     console.log('Email sent!', completedJob.result);
   *   });
   */
  onJobCompleted(jobId: string, callback: (job: JobResponse) => void): void {
    this.onEvent("job:completed", (data: any) => {
      if (data.job?.id === jobId) {
        callback(data.job);
      }
    });
  }

  /**
   * Listen for a specific job failing
   *
   * Example:
   *   client.onJobFailed(job.id, (failedJob) => {
   *     console.error('Job failed:', failedJob.error);
   *   });
   */
  onJobFailed(jobId: string, callback: (job: JobResponse) => void): void {
    this.onEvent("job:failed", (data: any) => {
      if (data.job?.id === jobId) {
        callback(data.job);
      }
    });
  }

  /**
   * Listen for a specific job's progress updates
   *
   * Example:
   *   client.onJobProgress(job.id, (job, progress) => {
   *     updateProgressBar(progress); // 0-100
   *   });
   */
  onJobProgress(
    jobId: string,
    callback: (job: JobResponse, progress: number) => void,
  ): void {
    this.onEvent("job:progress", (data: any) => {
      if (data.job?.id === jobId) {
        callback(data.job, data.progress);
      }
    });
  }

  /**
   * Listen for any event type
   * Generic listener for advanced use cases
   *
   * Example:
   *   client.onEvent('queue:drain', () => {
   *     console.log('All jobs done!');
   *   });
   */
  onEvent(eventType: string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  // Internal methods

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    const eventType = message.type;
    const listeners = this.listeners.get(eventType);

    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(message.data || message);
        } catch (error) {
          console.error(
            `[job-queue-system SDK] Error in listener for "${eventType}":`,
            error,
          );
        }
      });
    }
  }

  /**
   * Attempt to reconnect if connection drops
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[job-queue-system SDK] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[job-queue-system SDK] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export class QueueError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "QueueError";
  }
}
