import type { Job, JobStatus, StorageAdapter } from "../types";

export class MemoryStorage implements StorageAdapter {
  private jobs: Map<string, Job> = new Map();

  async saveJob(job: Job): Promise<void> {
    // Clone to avoid external mutations
    this.jobs.set(job.id, { ...job });
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    this.jobs.delete(jobId);
  }

  async listJobs(status?: JobStatus): Promise<Job[]> {
    const all = Array.from(this.jobs.values());
    if (status) {
      return all.filter((j) => j.status === status);
    }
    return all;
  }

  async clearAll(): Promise<void> {
    this.jobs.clear();
  }

  async close(): Promise<void> {
    // Nothing to close
  }
}
