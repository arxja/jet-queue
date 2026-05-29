export interface DashboardStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
  throughput: number;
  uptime: number;
  workerCount: number;
}

export interface JobWithDuration {
  id: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  error?: string;
  duration?: number; // ms
  createdAt: string;
}

export interface ConnectionStatus {
  connected: boolean;
  serverUrl: string;
  error?: string;
}
