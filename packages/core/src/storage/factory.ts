import type { StorageAdapter } from "../types";
import type { JetQueueConfig } from "../config/loader";
import { MemoryStorage } from "./memory";
import { SQLiteStorage } from "./sqlite";

export class StorageFactory {
  static async create(config: JetQueueConfig): Promise<StorageAdapter> {
    const storageConfig = config.storage;

    switch (storageConfig.type) {
      case "memory":
        return new MemoryStorage();

      case "sqlite": {
        const filename = storageConfig.sqlite?.filename ?? ":memory:";
        return new SQLiteStorage(filename);
      }

      case "postgres": {
        const { PostgresStorage } = await import("./postgres");
        return new PostgresStorage(storageConfig.postgres || {});
      }

      case "redis":
        const { RedisStorage } = await import("./redis");
        return new RedisStorage(storageConfig.redis || {});

      default:
        throw new Error(
          `Unknown storage type: ${(storageConfig as any)?.type}. Supported types: memory, sqlite, postgres, redis`,
        );
    }
  }
}
