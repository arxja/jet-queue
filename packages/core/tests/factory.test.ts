import { describe, it, expect } from "bun:test";
import { StorageFactory } from "../src/storage/factory";
import { MemoryStorage } from "../src/storage/memory";
import { SQLiteStorage } from "../src/storage/sqlite";
import { RedisStorage } from "@/storage/redis";
import { PostgresStorage } from "@/storage/postgres";

describe("StorageFactory", () => {
  it("creates MemoryStorage for type 'memory'", async () => {
    const adapter = await StorageFactory.create({
      storage: { type: "memory" },
    } as any);
    expect(adapter).toBeInstanceOf(MemoryStorage);
  });

  it("creates SQLiteStorage for type 'sqlite'", async () => {
    const adapter = await StorageFactory.create({
      storage: { type: "sqlite", sqlite: { filename: ":memory:" } },
    } as any);
    expect(adapter).toBeInstanceOf(SQLiteStorage);
  });

  it("throws for unsupported types", async () => {
    await expect(
      StorageFactory.create({ storage: { type: "mongodb" } } as any),
    ).rejects.toThrow("Unknown storage type");
  });

  it("creates PostgresStorage for type 'postgres'", async () => {
    // Mock the dynamic import or verify dispatch without a live DB
    const adapter = await StorageFactory.create({
      storage: {
        type: "postgres",
        postgres: { host: "localhost", port: 5432, database: "test" },
      },
    } as any);
    expect(adapter).toBeInstanceOf(PostgresStorage);
  });

  it("creates RedisStorage for type 'redis'", async () => {
    const adapter = await StorageFactory.create({
      storage: {
        type: "redis",
        redis: { host: "localhost", port: 6379 },
      },
    } as any);
    expect(adapter).toBeInstanceOf(RedisStorage);
  });
});
