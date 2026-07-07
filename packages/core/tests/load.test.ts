import { describe, it, expect, vi, beforeEach } from "bun:test";
import { ConfigLoader, loadConfig } from "@/config/loader";
import { cosmiconfig } from "cosmiconfig";

vi.mock("cosmiconfig", () => ({
  cosmiconfig: vi.fn(),
}));

describe("ConfigLoader", () => {
  beforeEach(() => {
    // Reset singleton and mocks
    // @ts-expect-error
    ConfigLoader.instance = undefined;
    vi.clearAllMocks();
    // Default: no file config
    (cosmiconfig as any).mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    });
  });

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
    // Provide a valid storage config in file mock (will be overridden by env)
    const mockSearch = mockSearchReturn({ storage: { type: "memory" } });
    (cosmiconfig as any).mockReturnValue({ search: mockSearch });

    const env = process.env as Record<string, string>;
    env.JETQUEUE_CONCURRENCY = "15";
    const config = await loadConfig({ env });
    expect(config.queue.concurrency).toBe(15);
    expect(config.storage.type).toBe("memory");

    delete env.JETQUEUE_CONCURRENCY;
  });

  it("throws on validation error", async () => {
    const mockConfig = {
      storage: { type: "invalid" },
    };
    mockSearchReturn(mockConfig);

    await expect(loadConfig()).rejects.toThrow(/Invalid configuration/);
  });

  it("provides section getters", async () => {
    const mockConfig = {
      queue: { concurrency: 10 },
      storage: { type: "memory" },
    };
    mockSearchReturn(mockConfig);

    const loader = ConfigLoader.getInstance();
    await loader.load();

    const queueConfig = loader.getQueueConfig();
    const storageConfig = loader.getStorageConfig();
    const queueSection = loader.getSection("queue");
    const storageSection = loader.getSection("storage");

    expect(queueConfig?.concurrency).toBe(10);
    expect(storageConfig?.type).toBe("memory");
    expect(queueSection?.concurrency).toBe(10);
    expect(storageSection?.type).toBe("memory");

    expect(loader.getPluginConfig("custom")).toBeUndefined();
    expect(loader.hasPluginConfig("custom")).toBe(false);
    expect(loader.hasPluginConfig("queue")).toBe(true);
  });
});
