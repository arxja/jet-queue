import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorage } from "../src/storage/memory";
import { SQLiteStorage } from "../src/storage/sqlite";
import type { Job, StorageAdapter } from "../src/types";

// Helper: create a sample job for testing
function createSampleJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job_test123",
    name: "send-email",
    data: { to: "user@test.com", subject: "Hello" },
    status: "pending",
    priority: "normal",
    attempts: 0,
    maxAttempts: 3,
    timeout: 30000,
    delay: 0,
    createdAt: Date.now(),
    progress: 0,
    tags: ["email", "welcome"],
    metadata: { userId: "456" },
    ...overrides,
  };
}

// This function runs the same tests against ANY storage implementation
// This proves our interface works correctly across backends
function runStorageTests(
  name: string,
  createStorage: () => StorageAdapter | Promise<StorageAdapter>,
  cleanup: (storage: StorageAdapter) => void | Promise<void> = () => {},
) {
  describe(`${name} - StorageAdapter Implementation`, () => {
    let storage: StorageAdapter;

    beforeEach(async () => {
      storage = await createStorage();
      await storage.clearAll();
    });

    // ---- SAVE & RETRIEVE ----
    describe("saveJob and getJob", () => {
      test("should save and retrieve a job", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        const retrieved = await storage.getJob(job.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(job.id);
        expect(retrieved!.name).toBe(job.name);
        expect(retrieved!.status).toBe("pending");
      });

      test("should return null for non-existent job", async () => {
        const result = await storage.getJob("nonexistent");
        expect(result).toBeNull();
      });

      test("should preserve complex data types", async () => {
        const job = createSampleJob({
          data: { nested: { deep: [1, 2, 3], value: true } },
          tags: ["important", "urgent"],
          metadata: { source: "api", version: 2 },
        });

        await storage.saveJob(job);
        const retrieved = await storage.getJob(job.id);

        expect(retrieved!.data).toEqual(job.data);
        expect(retrieved!.tags).toEqual(job.tags);
        expect(retrieved!.metadata).toEqual(job.metadata);
      });
    });

    // ---- UPDATE ----
    describe("updateJob", () => {
      test("should update job status", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        await storage.updateJob(job.id, {
          status: "running",
          startedAt: Date.now(),
          attempts: 1,
        });

        const updated = await storage.getJob(job.id);
        expect(updated!.status).toBe("running");
        expect(updated!.attempts).toBe(1);
        expect(updated!.startedAt).toBeDefined();
      });

      test("should update job on completion", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        const now = Date.now();
        await storage.updateJob(job.id, {
          status: "completed",
          completedAt: now,
          result: { sent: true, messageId: "msg_789" },
          progress: 100,
        });

        const updated = await storage.getJob(job.id);
        expect(updated!.status).toBe("completed");
        expect(updated!.progress).toBe(100);
        expect(updated!.result).toEqual({ sent: true, messageId: "msg_789" });
      });

      test("should update job on failure", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        await storage.updateJob(job.id, {
          status: "failed",
          error: "Email service unavailable",
          completedAt: Date.now(),
        });

        const updated = await storage.getJob(job.id);
        expect(updated!.status).toBe("failed");
        expect(updated!.error).toBe("Email service unavailable");
      });

      test("should not throw when updating non-existent job", async () => {
        // Should gracefully handle this
        await storage.updateJob("ghost_job", { status: "completed" });
        // No error = test passes
      });
    });

    // ---- DELETE ----
    describe("deleteJob", () => {
      test("should delete a job", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        await storage.deleteJob(job.id);

        const result = await storage.getJob(job.id);
        expect(result).toBeNull();
      });

      test("should not throw when deleting non-existent job", async () => {
        await storage.deleteJob("ghost_job");
        // No error = test passes
      });
    });

    // ---- LIST JOBS ----
    describe("listJobs", () => {
      test("should list all jobs", async () => {
        const jobs = [
          createSampleJob({ id: "job_1", status: "pending" }),
          createSampleJob({ id: "job_2", status: "completed" }),
          createSampleJob({ id: "job_3", status: "failed" }),
        ];

        for (const job of jobs) {
          await storage.saveJob(job);
        }

        const all = await storage.listJobs();
        expect(all.length).toBe(3);
      });

      test("should filter jobs by status", async () => {
        await storage.saveJob(
          createSampleJob({ id: "job_1", status: "pending" }),
        );
        await storage.saveJob(
          createSampleJob({ id: "job_2", status: "pending" }),
        );
        await storage.saveJob(
          createSampleJob({ id: "job_3", status: "completed" }),
        );

        const pending = await storage.listJobs("pending");
        expect(pending.length).toBe(2);
        expect(pending.every((j) => j.status === "pending")).toBe(true);

        const completed = await storage.listJobs("completed");
        expect(completed.length).toBe(1);
      });

      test("should return empty array when no jobs match", async () => {
        const result = await storage.listJobs("running");
        expect(result).toEqual([]);
      });
    });

    // ---- CLEAR ALL ----
    describe("clearAll", () => {
      test("should remove all jobs", async () => {
        await storage.saveJob(createSampleJob({ id: "job_1" }));
        await storage.saveJob(createSampleJob({ id: "job_2" }));

        await storage.clearAll();

        const all = await storage.listJobs();
        expect(all.length).toBe(0);
      });
    });

    // ---- EDGE CASES ----
    describe("edge cases", () => {
      test("should handle jobs with empty tags and metadata", async () => {
        const job = createSampleJob({ tags: [], metadata: {} });
        await storage.saveJob(job);

        const retrieved = await storage.getJob(job.id);
        expect(retrieved!.tags).toEqual([]);
        expect(retrieved!.metadata).toEqual({});
      });

      test("should handle multiple saves of same job (upsert)", async () => {
        const job = createSampleJob();
        await storage.saveJob(job);

        // Update and save again
        job.status = "completed";
        await storage.saveJob(job);

        const retrieved = await storage.getJob(job.id);
        expect(retrieved!.status).toBe("completed");
      });
    });

    // Cleanup after all tests
    if (cleanup) {
      // Note: We call cleanup manually since there's no afterAll per-describe in bun
    }
  });
}

// RUN TESTS AGAINST MEMORY STORAGE
runStorageTests("MemoryStorage", () => new MemoryStorage());

// RUN TESTS AGAINST SQLITE STORAGE
runStorageTests(
  "SQLiteStorage",
  () => new SQLiteStorage(), // Uses in-memory SQLite (:memory:)
  async (storage) => await storage.close(),
);
