import { baseConfigSchema } from "@/config/schema";
import { describe, it, expect } from "bun:test";

describe("baseConfigSchema", () => {
  it("validates a minimal config", () => {
    const valid = {
      storage: { type: "memory" },
    };
    expect(() => baseConfigSchema.parse(valid)).not.toThrow();
  });

  it("validates a full config", () => {
    const full = {
      queue: {
        concurrency: 10,
        maxQueuedJobs: 20000,
        autoStart: false,
        defaultJobOptions: {
          priority: "high",
          timeout: 60000,
          maxAttempts: 5,
          retryOptions: {
            strategy: "linear",
            delay: 2000,
            maxDelay: 30000,
          },
        },
      },
      storage: {
        type: "postgres",
        postgres: {
          host: "localhost",
          database: "test",
          username: "user",
          password: "pass",
        },
      },
    };
    expect(() => baseConfigSchema.parse(full)).not.toThrow();
  });

  it("rejects invalid storage config - missing postgres config", () => {
    const invalid = {
      storage: { type: "postgres" },
    };
    expect(() => baseConfigSchema.parse(invalid)).toThrow(/Invalid input/);
  });

  it("rejects invalid storage config - missing connection info", () => {
    const invalid = {
      storage: {
        type: "postgres",
        postgres: {
          host: "localhost",
          // missing database
        },
      },
    };
    expect(() => baseConfigSchema.parse(invalid)).toThrow(
      /Either connectionString or \(host \+ database\) is required/,
    );
  });

  it("rejects invalid queue concurrency", () => {
    const invalid = {
      queue: { concurrency: -1 },
      storage: { type: "memory" },
    };
    expect(() => baseConfigSchema.parse(invalid)).toThrow(
      /Must be a positive integer/,
    );
  });

  describe("storage configurations", () => {
    it("validates postgres with connectionString", () => {
      const config = {
        storage: {
          type: "postgres",
          postgres: {
            connectionString: "postgresql://user:pass@localhost:5432/db",
          },
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("validates redis config", () => {
      const config = {
        storage: {
          type: "redis",
          redis: {
            host: "localhost",
            port: 6379,
            password: "secret",
            db: 1,
            prefix: "custom:",
          },
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("validates redis with connectionString", () => {
      const config = {
        storage: {
          type: "redis",
          redis: {
            connectionString: "redis://:password@localhost:6379/0",
          },
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("validates sqlite config", () => {
      const config = {
        storage: {
          type: "sqlite",
          sqlite: {
            filename: "./data.db",
            wal: false,
            busyTimeout: 10000,
          },
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("validates sqlite with defaults", () => {
      const config = {
        storage: {
          type: "sqlite",
          sqlite: {},
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("rejects invalid storage type", () => {
      const invalid = {
        storage: { type: "mongodb" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow();
      expect(() => baseConfigSchema.parse(invalid)).toThrow(/Invalid discriminator/);
    });

    it("rejects redis without host or connectionString", () => {
      const invalid = {
        storage: {
          type: "redis",
          redis: {
            port: 6379, // missing host and connectionString
          },
        },
      };
      // New validation requires either connectionString or (host + port)
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Either connectionString or \(host \+ port\) is required/,
      );
    });
  });

  describe("queue configurations", () => {
    it("uses defaults when queue config is partial", () => {
      const config = {
        queue: {
          concurrency: 3,
        },
        storage: { type: "memory" },
      };
      const result = baseConfigSchema.parse(config);
      expect(result.queue.concurrency).toBe(3);
      expect(result.queue.maxQueuedJobs).toBe(10000);
      expect(result.queue.autoStart).toBe(true);
    });

    it("validates maxQueuedJobs must be positive", () => {
      const invalid = {
        queue: { maxQueuedJobs: 0 },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >0/,
      );
    });

    it("validates job priority enum", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            priority: "urgent",
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Invalid option: expected one of /,
      );
    });

    it("validates timeout must be positive", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            timeout: -1000,
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >0/,
      );
    });

    it("validates maxAttempts must be positive integer", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            maxAttempts: 0,
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >0/,
      );
    });
  });

  describe("retry options", () => {
    it("validates retry strategy enum", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            retryOptions: {
              strategy: "random",
            },
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Invalid option: expected one of /,
      );
    });

    it("validates retry delay must be positive", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            retryOptions: {
              delay: 0,
            },
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >0/,
      );
    });

    it("validates maxDelay must be positive when provided", () => {
      const invalid = {
        queue: {
          defaultJobOptions: {
            retryOptions: {
              strategy: "exponential",
              delay: 1000,
              maxDelay: -100,
            },
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >0/,
      );
    });

    it("allows retryOptions without maxDelay", () => {
      const config = {
        queue: {
          defaultJobOptions: {
            retryOptions: {
              strategy: "fixed",
              delay: 5000,
            },
          },
        },
        storage: { type: "memory" },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });
  });

  describe("postgres config validation", () => {
    it("validates port range", () => {
      const invalid = {
        storage: {
          type: "postgres",
          postgres: {
            host: "localhost",
            database: "test",
            port: 99999,
          },
        },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too big: expected number to be <=65535/,
      );
    });

    it("validates pool configuration", () => {
      const config = {
        storage: {
          type: "postgres",
          postgres: {
            host: "localhost",
            database: "test",
            pool: {
              min: 1,
              max: 20,
            },
          },
        },
      };
      expect(() => baseConfigSchema.parse(config)).not.toThrow();
    });

    it("validates pool min cannot be negative", () => {
      const invalid = {
        storage: {
          type: "postgres",
          postgres: {
            host: "localhost",
            database: "test",
            pool: {
              min: -1,
            },
          },
        },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >=0/,
      );
    });

    it("validates pool max must be at least 1", () => {
      const invalid = {
        storage: {
          type: "postgres",
          postgres: {
            host: "localhost",
            database: "test",
            pool: {
              max: 0,
            },
          },
        },
      };
      expect(() => baseConfigSchema.parse(invalid)).toThrow(
        /Too small: expected number to be >=1/,
      );
    });
  });

  describe("default values", () => {
    it("provides complete defaults when config is minimal", () => {
      const config = {
        storage: { type: "memory" },
      };
      const result = baseConfigSchema.parse(config);
      expect(result.queue).toBeDefined();
      expect(result.queue.concurrency).toBe(5);
      expect(result.queue.maxQueuedJobs).toBe(10000);
      expect(result.queue.autoStart).toBe(true);
      expect(result.queue.defaultJobOptions).toBeDefined();
      expect(result.queue.defaultJobOptions.priority).toBe("normal");
      expect(result.queue.defaultJobOptions.timeout).toBe(30000);
      expect(result.queue.defaultJobOptions.maxAttempts).toBe(3);
      expect(result.queue.defaultJobOptions.retryOptions).toBeDefined();
      expect(result.queue.defaultJobOptions.retryOptions?.strategy).toBe(
        "exponential",
      );
      expect(result.queue.defaultJobOptions.retryOptions?.delay).toBe(1000);
      expect(result.queue.defaultJobOptions.retryOptions?.maxDelay).toBe(60000);
    });
  });
});
