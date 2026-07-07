import { describe, it, expect, vi, beforeEach } from "bun:test";
import { z } from "zod";
import {
  registerConfigSchema,
  getCombinedSchema,
  configRegistry,
} from "@/config/schema";
import { ConfigLoader } from "@/config/loader";
import { cosmiconfig } from "cosmiconfig";

vi.mock("cosmiconfig", () => ({
  cosmiconfig: vi.fn(),
}));

describe("Plugin Registration", () => {
  beforeEach(() => {
    // Clear registry and reset singleton
    configRegistry.clear();
    // @ts-expect-error - accessing private static for testing
    ConfigLoader.instance = undefined;
    vi.clearAllMocks();
  });

  it("registers a plugin schema and includes it in combined schema", () => {
    const pluginSchema = z.object({
      myPlugin: z.object({
        apiKey: z.string(),
        timeout: z.number().optional(),
      }),
    });

    registerConfigSchema("myPlugin", pluginSchema);

    const combined = getCombinedSchema();
    expect(combined.shape).toHaveProperty("myPlugin");
    // Validate that it accepts valid plugin config
    const config = {
      queue: { concurrency: 5 },
      storage: { type: "memory" },
      myPlugin: {
        apiKey: "abc123",
        timeout: 5000,
      },
    };
    expect(() => combined.parse(config)).not.toThrow();
  });

  it("validates plugin config with the registered schema", () => {
    const pluginSchema = z.object({
      myPlugin: z.object({
        apiKey: z.string().min(5),
        timeout: z.number().positive(),
      }),
    });

    registerConfigSchema("myPlugin", pluginSchema);
    const combined = getCombinedSchema();

    const invalidConfig = {
      queue: { concurrency: 5 },
      storage: { type: "memory" },
      myPlugin: {
        apiKey: "abc", // too short
        timeout: -10, // negative
      },
    };
    expect(() => combined.parse(invalidConfig)).toThrow();
  });

  it("loads config with plugin section from file", async () => {
    const pluginSchema = z.object({
      customPlugin: z.object({
        enabled: z.boolean().default(true),
        endpoint: z.string().url(),
      }),
    });
    registerConfigSchema("customPlugin", pluginSchema);

    const mockConfig = {
      queue: { concurrency: 10 },
      storage: { type: "memory" },
      customPlugin: {
        enabled: true,
        endpoint: "https://api.example.com",
      },
    };
    const mockSearch = vi.fn().mockResolvedValue({ config: mockConfig });
    (cosmiconfig as any).mockReturnValue({ search: mockSearch });

    const loader = ConfigLoader.getInstance();
    await loader.load();

    const pluginConfig = loader.getPluginConfig("customPlugin");
    expect(pluginConfig).toEqual({
      enabled: true,
      endpoint: "https://api.example.com",
    });
    expect(loader.hasPluginConfig("customPlugin")).toBe(true);
  });

  it("applies defaults from plugin schema", async () => {
    const pluginSchema = z.object({
      analytics: z.object({
        enabled: z.boolean().default(true),
        level: z.enum(["debug", "info", "error"]).default("info"),
      }),
    });
    registerConfigSchema("analytics", pluginSchema);

    const mockConfig = {
      queue: { concurrency: 10 },
      storage: { type: "memory" },
      analytics: {
        // enabled is omitted, should default to true
        level: "debug",
      },
    };
    const mockSearch = vi.fn().mockResolvedValue({ config: mockConfig });
    (cosmiconfig as any).mockReturnValue({ search: mockSearch });

    const loader = ConfigLoader.getInstance();
    await loader.load();

    // Use getSection to access dynamic plugin config
    const analyticsConfig = loader.getSection("analytics");
    expect(analyticsConfig?.enabled).toBe(true);
    expect(analyticsConfig?.level).toBe("debug");
  });

  it("handles multiple plugins", () => {
    const schema1 = z.object({ pluginA: z.object({ foo: z.string() }) });
    const schema2 = z.object({ pluginB: z.object({ bar: z.number() }) });
    registerConfigSchema("pluginA", schema1);
    registerConfigSchema("pluginB", schema2);

    const combined = getCombinedSchema();
    expect(combined.shape).toHaveProperty("pluginA");
    expect(combined.shape).toHaveProperty("pluginB");

    const config = {
      queue: { concurrency: 5 },
      storage: { type: "memory" },
      pluginA: { foo: "hello" },
      pluginB: { bar: 42 },
    };
    expect(() => combined.parse(config)).not.toThrow();
  });
});
