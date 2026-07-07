import { describe, it, expect, vi, beforeEach } from "bun:test";
import { ConfigLoader, loadConfig } from "@/config/loader";
import { cosmiconfig } from "cosmiconfig";

// Mock cosmiconfig
vi.mock("cosmiconfig", () => ({
  cosmiconfig: vi.fn(),
}));

describe("ConfigLoader", () => {
  // Reset singleton and mocks before each test
  beforeEach(() => {
    // @ts-expect-error - accessing private static for testing
    ConfigLoader.instance = undefined;
    vi.clearAllMocks();
  });

  // Helper to mock cosmiconfig search result
  function mockSearchReturn(config: any) {
    const mockSearch = vi.fn().mockResolvedValue({ config });
    (cosmiconfig as any).mockReturnValue({ search: mockSearch });
    return mockSearch;
  }

  it("loads config from file", async () => {
    const mockConfig = {
      queue: { concurrency: 20 },
      storage: { type: "memory" },
    };
    const mockSearch = mockSearchReturn(mockConfig);

    const config = await loadConfig();
    expect(config.queue.concurrency).toBe(20);
    expect(mockSearch).toHaveBeenCalled();
  });

  it("merges environment variables", async () => {
    // Use memory storage to avoid needing postgres config
    const mockSearch = mockSearchReturn({ storage: { type: "memory" } });

    // Cast process.env to Record<string, string> because we know we set string values.
    const env = process.env as Record<string, string>;
    env.JETQUEUE_CONCURRENCY = "15";

    const config = await loadConfig({ env });
    expect(config.queue.concurrency).toBe(15);
    expect(config.storage.type).toBe("memory");

    // Clean up
    delete env.JETQUEUE_CONCURRENCY;
  });

  it("throws on validation error", async () => {
    const mockConfig = {
      storage: { type: "invalid" }, // 'invalid' is not allowed
    };
    mockSearchReturn(mockConfig);

    expect(loadConfig()).rejects.toThrow(/Invalid configuration/);
  });

  it("provides section getters", async () => {
    const mockConfig = {
      queue: { concurrency: 10 },
      storage: { type: "memory" },
    };
    mockSearchReturn(mockConfig);

    const loader = ConfigLoader.getInstance();
    await loader.load();

    // Get values with explicit non-null assertion since we know they exist after load()
    const queueConfig = loader.getQueueConfig();
    const storageConfig = loader.getStorageConfig();
    const queueSection = loader.getSection("queue");
    const storageSection = loader.getSection("storage");

    // Check that the values we set are present (along with defaults)
    expect(queueConfig?.concurrency).toBe(10);
    expect(storageConfig?.type).toBe("memory");
    expect(queueSection?.concurrency).toBe(10);
    expect(storageSection?.type).toBe("memory");

    // Check that defaults are applied
    expect(queueConfig?.maxQueuedJobs).toBe(10000);
    expect(queueConfig?.autoStart).toBe(true);
    expect(queueConfig?.defaultJobOptions?.priority).toBe("normal");

    // Plugin getters work for unknown plugins (return undefined)
    expect(loader.getPluginConfig("custom")).toBeUndefined();
    expect(loader.hasPluginConfig("custom")).toBe(false);

    // 'queue' is a known section
    expect(loader.hasPluginConfig("queue")).toBe(true);
  });
});
