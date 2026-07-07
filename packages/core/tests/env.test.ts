import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import { ConfigLoader } from "@/config/loader";
import { cosmiconfig } from "cosmiconfig";

vi.mock("cosmiconfig", () => ({
  cosmiconfig: vi.fn(),
}));

describe("Environment Variables Parsing", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
    // Clear env for isolation
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith("JETQUEUE_") ||
        key === "DATABASE_URL" ||
        key === "REDIS_URL"
      ) {
        delete process.env[key];
      }
    }
    // Reset singleton
    // @ts-expect-error - accessing private static for testing
    ConfigLoader.instance = undefined;
    vi.clearAllMocks();
    // Mock cosmiconfig to return no file config (empty)
    (cosmiconfig as any).mockReturnValue({
      search: vi.fn().mockResolvedValue(null),
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it("parses queue settings from env", async () => {
    process.env.JETQUEUE_CONCURRENCY = "10";
    process.env.JETQUEUE_MAX_QUEUED_JOBS = "5000";
    process.env.JETQUEUE_AUTO_START = "false";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.queue.concurrency).toBe(10);
    expect(config.queue.maxQueuedJobs).toBe(5000);
    expect(config.queue.autoStart).toBe(false);
  });

  it("parses default job options from env", async () => {
    process.env.JETQUEUE_DEFAULT_PRIORITY = "high";
    process.env.JETQUEUE_DEFAULT_TIMEOUT = "60000";
    process.env.JETQUEUE_DEFAULT_MAX_ATTEMPTS = "5";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.queue.defaultJobOptions.priority).toBe("high");
    expect(config.queue.defaultJobOptions.timeout).toBe(60000);
    expect(config.queue.defaultJobOptions.maxAttempts).toBe(5);
  });

  it("parses retry options from env", async () => {
    process.env.JETQUEUE_RETRY_STRATEGY = "linear";
    process.env.JETQUEUE_RETRY_DELAY = "2000";
    process.env.JETQUEUE_RETRY_MAX_DELAY = "30000";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.queue.defaultJobOptions.retryOptions?.strategy).toBe(
      "linear",
    );
    expect(config.queue.defaultJobOptions.retryOptions?.delay).toBe(2000);
    expect(config.queue.defaultJobOptions.retryOptions?.maxDelay).toBe(30000);
  });

  it("parses postgres config from env (with connection string)", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/mydb";
    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("postgres");
    // Use type assertion to access postgres property
    const postgres = (config.storage as any).postgres;
    expect(postgres?.connectionString).toBe(
      "postgresql://user:pass@localhost:5432/mydb",
    );
  });

  it("parses postgres config from env (with individual fields)", async () => {
    process.env.JETQUEUE_POSTGRES_HOST = "db.example.com";
    process.env.JETQUEUE_POSTGRES_PORT = "5433";
    process.env.JETQUEUE_POSTGRES_DATABASE = "testdb";
    process.env.JETQUEUE_POSTGRES_USERNAME = "admin";
    process.env.JETQUEUE_POSTGRES_PASSWORD = "secret";
    process.env.JETQUEUE_POSTGRES_SCHEMA = "public";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("postgres");
    const postgres = (config.storage as any).postgres;
    expect(postgres?.host).toBe("db.example.com");
    expect(postgres?.port).toBe(5433);
    expect(postgres?.database).toBe("testdb");
    expect(postgres?.username).toBe("admin");
    expect(postgres?.password).toBe("secret");
    expect(postgres?.schema).toBe("public");
  });

  it("parses redis config from env (with connection string)", async () => {
    process.env.REDIS_URL = "redis://:password@cache:6379/1";
    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("redis");
    const redis = (config.storage as any).redis;
    expect(redis?.connectionString).toBe("redis://:password@cache:6379/1");
  });

  it("parses redis config from env (with individual fields)", async () => {
    process.env.JETQUEUE_REDIS_HOST = "redis.example.com";
    process.env.JETQUEUE_REDIS_PORT = "6380";
    process.env.JETQUEUE_REDIS_PASSWORD = "pass123";
    process.env.JETQUEUE_REDIS_DB = "2";
    process.env.JETQUEUE_REDIS_PREFIX = "myapp:";
    process.env.JETQUEUE_REDIS_MAX_RETRIES = "5";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("redis");
    const redis = (config.storage as any).redis;
    expect(redis?.host).toBe("redis.example.com");
    expect(redis?.port).toBe(6380);
    expect(redis?.password).toBe("pass123");
    expect(redis?.db).toBe(2);
    expect(redis?.prefix).toBe("myapp:");
    expect(redis?.maxRetries).toBe(5);
  });

  it("parses sqlite config from env", async () => {
    process.env.JETQUEUE_SQLITE_FILENAME = "./data/app.db";
    process.env.JETQUEUE_SQLITE_WAL = "false";
    process.env.JETQUEUE_SQLITE_BUSY_TIMEOUT = "10000";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("sqlite");
    const sqlite = (config.storage as any).sqlite;
    expect(sqlite?.filename).toBe("./data/app.db");
    expect(sqlite?.wal).toBe(false);
    expect(sqlite?.busyTimeout).toBe(10000);
  });

  it("parses memory storage from env", async () => {
    process.env.JETQUEUE_STORAGE_TYPE = "memory";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.storage.type).toBe("memory");
    // Use type assertion to check absence of storage-specific properties
    const storage = config.storage as any;
    expect(storage.postgres).toBeUndefined();
    expect(storage.redis).toBeUndefined();
    expect(storage.sqlite).toBeUndefined();
  });

  it("prioritizes environment variables over file config for primitive values", async () => {
    const mockConfig = {
      queue: { concurrency: 20 },
      storage: { type: "memory" },
    };
    (cosmiconfig as any).mockReturnValue({
      search: vi.fn().mockResolvedValue({ config: mockConfig }),
    });

    process.env.JETQUEUE_CONCURRENCY = "15";
    process.env.JETQUEUE_STORAGE_TYPE = "postgres";
    // Add required postgres fields to make config valid
    process.env.JETQUEUE_POSTGRES_HOST = "localhost";
    process.env.JETQUEUE_POSTGRES_DATABASE = "test";

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    // Env wins for primitive values due to mergeDeep
    expect(config.queue.concurrency).toBe(15);
    expect(config.storage.type).toBe("postgres");
    // Ensure the postgres config is present (from env)
    expect((config.storage as any).postgres?.host).toBe("localhost");
  });

  it("does not override file config if env is missing", async () => {
    const mockConfig = {
      queue: { concurrency: 20, maxQueuedJobs: 5000 },
      storage: { type: "memory" },
    };
    (cosmiconfig as any).mockReturnValue({
      search: vi.fn().mockResolvedValue({ config: mockConfig }),
    });

    const loader = ConfigLoader.getInstance();
    const config = await loader.load();

    expect(config.queue.concurrency).toBe(20);
    expect(config.queue.maxQueuedJobs).toBe(5000);
    expect(config.storage.type).toBe("memory");
  });
});
