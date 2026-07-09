import { describe, it, expect } from "bun:test";
import { StorageFactory } from "../src/storage/factory";
import { MemoryStorage } from "../src/storage/memory";
import { SQLiteStorage } from "../src/storage/sqlite";

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

});
