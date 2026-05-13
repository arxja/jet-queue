import { describe, test, expect, beforeEach } from "bun:test";
import { HandlerRegistry } from "../src/handlers";

describe("HandlerRegistry", () => {
  let registry: HandlerRegistry;

  // Fresh registry for each test
  beforeEach(() => {
    registry = new HandlerRegistry();
  });

  describe("register and get", () => {
    test("should register and retrieve a handler", async () => {
      const handler = async (job: any) => "sent";

      registry.register("send-email", handler);

      const retrieved = registry.get("send-email");
      expect(retrieved).toBe(handler); // Same function reference
    });

    test("should register multiple handlers", () => {
      const emailHandler = async (job: any) => "email";
      const reportHandler = async (job: any) => "report";

      registry.register("send-email", emailHandler);
      registry.register("generate-report", reportHandler);

      expect(registry.get("send-email")).toBe(emailHandler);
      expect(registry.get("generate-report")).toBe(reportHandler);
    });

    test("should check if handler exists", () => {
      registry.register("send-email", async () => {});

      expect(registry.has("send-email")).toBe(true);
      expect(registry.has("unknown")).toBe(false);
    });
  });

  describe("error handling", () => {
    test("should throw when registering duplicate handler", () => {
      registry.register("send-email", async () => {});

      expect(() => {
        registry.register("send-email", async () => {});
      }).toThrow('Handler "send-email" is already registered');
    });

    test("should throw when getting unregistered handler", () => {
      expect(() => {
        registry.get("nonexistent");
      }).toThrow('No handler registered for "nonexistent"');
    });
  });

  describe("integration scenario", () => {
    test("should simulate real usage pattern", async () => {
      // This mimics how the queue uses the registry
      const executed: any[] = [];

      // Register handlers on startup
      registry.register("send-email", async (job) => {
        executed.push({ handler: "send-email", data: job.data });
      });

      registry.register("generate-report", async (job) => {
        executed.push({ handler: "generate-report", data: job.data });
      });

      // Simulate executing jobs by name (like queue.restoreJob would)
      const pendingJobs = [
        { name: "send-email", data: { to: "a@test.com" } },
        { name: "send-email", data: { to: "b@test.com" } },
        { name: "generate-report", data: { reportId: 123 } },
      ];

      for (const jobData of pendingJobs) {
        const handler = registry.get(jobData.name);
        await handler({ data: jobData.data } as any);
      }

      expect(executed.length).toBe(3);
      expect(executed[0]).toEqual({
        handler: "send-email",
        data: { to: "a@test.com" },
      });
      expect(executed[1]).toEqual({
        handler: "send-email",
        data: { to: "b@test.com" },
      });
      expect(executed[2]).toEqual({
        handler: "generate-report",
        data: { reportId: 123 },
      });
    });
  });
});
