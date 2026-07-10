import { it, expect, beforeAll, afterAll } from "bun:test";
import type { StorageAdapter } from "../src/types";
import type { Job } from "../src/types";

// This factory will be called by each adapter's test file
export function runAdapterTests(
  createAdapter: () => StorageAdapter | Promise<StorageAdapter>,
  cleanup?: () => Promise<void>,
) {
  let adapter: StorageAdapter;

  beforeAll(async () => {
    adapter = await createAdapter();
    // Ensure clean state before tests
    await adapter.clearAll?.();
  });

  afterAll(async () => {
    await adapter?.close?.();
    await cleanup?.();
  });

  const createTestJob = (overrides: Partial<Job> = {}): Job => ({
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "test-job",
    data: { foo: "bar" },
    status: "pending",
    priority: "normal",
    attempts: 0,
    maxAttempts: 3,
    timeout: 30000,
    delay: 0,
    createdAt: Date.now(),
    progress: 0,
    tags: ["test"],
    metadata: {},
    ...overrides,
  });

  // Helper to ensure clean state between tests
  const cleanState = async () => {
    if (adapter.clearAll) {
      await adapter.clearAll();
    }
  };

  it("saveJob and getJob", async () => {
    await cleanState();
    const job = createTestJob();
    await adapter.saveJob(job);

    const retrieved = await adapter.getJob(job.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(job.id);
    expect(retrieved!.name).toBe("test-job");
    expect(retrieved!.data).toEqual({ foo: "bar" });
  });

  it("getJob returns null for non-existent job", async () => {
    await cleanState();
    const retrieved = await adapter.getJob("non-existent");
    expect(retrieved).toBeNull();
  });

  it("updateJob modifies existing job", async () => {
    await cleanState();
    const job = createTestJob();
    await adapter.saveJob(job);

    await adapter.updateJob(job.id, { status: "completed", progress: 100 });

    const updated = await adapter.getJob(job.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.progress).toBe(100);
    // Other fields should remain unchanged
    expect(updated!.name).toBe("test-job");
  });

  it("updateJob does nothing for non-existent job", async () => {
    await cleanState();
    // Should not throw
    await expect(
      adapter.updateJob("non-existent", { status: "completed" }),
    ).resolves.not.toThrow();
  });

  it("deleteJob removes job", async () => {
    await cleanState();
    const job = createTestJob();
    await adapter.saveJob(job);
    await adapter.deleteJob(job.id);

    const retrieved = await adapter.getJob(job.id);
    expect(retrieved).toBeNull();
  });

  it("listJobs returns all jobs when no status filter", async () => {
    await cleanState();

    const job1 = createTestJob({ status: "pending" });
    const job2 = createTestJob({ status: "completed" });
    const job3 = createTestJob({ status: "failed" });

    await adapter.saveJob(job1);
    await adapter.saveJob(job2);
    await adapter.saveJob(job3);

    const all = await adapter.listJobs();
    expect(all).toHaveLength(3);

    // Verify all jobs are present
    const ids = all.map((j) => j.id);
    expect(ids).toContain(job1.id);
    expect(ids).toContain(job2.id);
    expect(ids).toContain(job3.id);
  });

  it("listJobs filters by status", async () => {
    await cleanState();

    await adapter.saveJob(createTestJob({ status: "pending" }));
    await adapter.saveJob(createTestJob({ status: "pending" }));
    await adapter.saveJob(createTestJob({ status: "completed" }));

    const pending = await adapter.listJobs("pending");
    expect(pending).toHaveLength(2);
    expect(pending.every((j) => j.status === "pending")).toBe(true);
  });

  it("clearAll removes all jobs", async () => {
    await cleanState();
    await adapter.saveJob(createTestJob());
    await adapter.saveJob(createTestJob());

    await adapter.clearAll();

    const all = await adapter.listJobs();
    expect(all).toHaveLength(0);
  });

  it("handles job with all fields (serialization round-trip)", async () => {
    await cleanState();
    const fullJob = createTestJob({
      data: { nested: { deep: true }, arr: [1, 2, 3] },
      tags: ["critical", "email"],
      metadata: { source: "api", userId: "123" },
      error: "Something went wrong",
      result: { sent: true, id: "msg-456" },
      startedAt: Date.now() - 5000,
      completedAt: Date.now(),
    });

    await adapter.saveJob(fullJob);
    const retrieved = await adapter.getJob(fullJob.id);

    expect(retrieved).toEqual(fullJob);
  });

  // Additional test for close() method
  it("close() should be callable without errors", async () => {
    await cleanState();
    const testAdapter = await createAdapter();
    await expect(testAdapter.close?.()).resolves.not.toThrow();
  });
}
