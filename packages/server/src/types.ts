export interface CreateJobRequest {
  handler: string; // Registered handler name
  data?: unknown; // Job payload
  priority?: "low" | "normal" | "high" | "critical";
  delay?: number; // Delay in ms
  timeout?: number;
  maxAttempts?: number;
  retryStrategy?: "fixed" | "linear" | "exponential";
  retryDelay?: number;
  tags?: string[];
}

export interface JobResponse {
  id: string;
  name: string;
  status: string;
  priority: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  data?: unknown;
  result?: unknown;
}

export interface QueueStatsResponse {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  throughput: number;
  uptime: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  uptime: number;
  queues: number;
  workers: number;
  version: string;
}
