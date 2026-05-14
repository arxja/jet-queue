// Req type
export interface AddJobOptions {
  data?: unknown;
  priority?: "low" | "normal" | "high" | "critical";
  delay?: number;
  timeout?: number;
  maxAttempts?: number;
  retryStrategy?: "fixed" | "linear" | "exponential";
  retryDelay?: number;
  tags?: string[];
}

// Res type

export interface JobResponse {
  id: string;
  name: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "delayed"
    | "cancelled";
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

export interface StatsResponse {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  throughput: number;
  uptime: number;
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  uptime: number;
  queues: number;
  workers: number;
  version: string;
}

// Websocket event

export type WSEventType =
  | "connected"
  | "job:added"
  | "job:started"
  | "job:completed"
  | "job:failed"
  | "job:progress"
  | "job:retry"
  | "queue:drain"
  | "queue:paused"
  | "queue:resumed";

export interface WSEvent {
  type: WSEventType;
  data: unknown;
  timestamp: number;
}

// Client options

export interface ClientOptions {
  baseUrl: string;
  retry?: {
    maxRetries: number;
    delay: number;
  };
}
