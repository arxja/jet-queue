import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";
import { baseConfigSchema, getCombinedSchema } from "./schema";

export type JetQueueConfig = z.infer<typeof baseConfigSchema>;

export interface ConfigOptions {
  configPath?: string;
  env?: Record<string, string>;
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: JetQueueConfig | null = null;

  static getInstance(): ConfigLoader {
    if (!this.instance) {
      this.instance = new ConfigLoader();
    }
    return this.instance;
  }

  async load(options: ConfigOptions = {}): Promise<JetQueueConfig> {
    // Try loading from file using cosmiconfig
    const explorer = cosmiconfig("jetqueue", {
      searchPlaces: [
        "package.json",
        ".jetqueuerc",
        ".jetqueuerc.json",
        ".jetqueuerc.yaml",
        ".jetqueuerc.yml",
        ".jetqueuerc.js",
        ".jetqueuerc.cjs",
        ".jetqueuerc.mjs",
        "jetqueue.config.js",
        "jetqueue.config.cjs",
        "jetqueue.config.mjs",
        "jetqueue.config.ts",
      ],
    });

    let result;
    if (options.configPath) {
      result = await explorer.load(options.configPath);
    } else {
      result = await explorer.search();
    }

    let config = result?.config || {};

    if (!config.storage) config.storage = { type: "memory" };

    // Merge with environment variables
    const envConfig = this.loadFromEnv(options.env || process.env);
    config = this.mergeDeep(config, envConfig);

    // Get combined schema with all registered plugins
    const schema = getCombinedSchema();

    try {
      // Validate against combined schema
      this.config = schema.parse(config) as JetQueueConfig;
      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Configuration validation failed:");
        error.issues.forEach((err) => {
          console.error(`  - ${err.path.join(".")}: ${err.message}`);
        });
        throw new Error(`Invalid configuration: ${error.message}`);
      }
      throw error;
    }
  }

  private loadFromEnv(
    env: Record<string, string | undefined>,
  ): Partial<JetQueueConfig> {
    const config: any = {};

    // Queue settings
    if (env.JETQUEUE_CONCURRENCY) {
      config.queue = {
        ...config.queue,
        concurrency: parseInt(env.JETQUEUE_CONCURRENCY, 10),
      };
    }

    if (env.JETQUEUE_MAX_QUEUED_JOBS) {
      config.queue = {
        ...config.queue,
        maxQueuedJobs: parseInt(env.JETQUEUE_MAX_QUEUED_JOBS, 10),
      };
    }

    if (env.JETQUEUE_AUTO_START) {
      config.queue = {
        ...config.queue,
        autoStart: env.JETQUEUE_AUTO_START.toLowerCase() === "true",
      };
    }

    // Job options
    if (env.JETQUEUE_DEFAULT_PRIORITY) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          priority: env.JETQUEUE_DEFAULT_PRIORITY,
        },
      };
    }

    if (env.JETQUEUE_DEFAULT_TIMEOUT) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          timeout: parseInt(env.JETQUEUE_DEFAULT_TIMEOUT, 10),
        },
      };
    }

    if (env.JETQUEUE_DEFAULT_MAX_ATTEMPTS) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          maxAttempts: parseInt(env.JETQUEUE_DEFAULT_MAX_ATTEMPTS, 10),
        },
      };
    }

    // Retry options
    if (env.JETQUEUE_RETRY_STRATEGY) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          retryOptions: {
            ...config.queue?.defaultJobOptions?.retryOptions,
            strategy: env.JETQUEUE_RETRY_STRATEGY,
          },
        },
      };
    }

    if (env.JETQUEUE_RETRY_DELAY) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          retryOptions: {
            ...config.queue?.defaultJobOptions?.retryOptions,
            delay: parseInt(env.JETQUEUE_RETRY_DELAY, 10),
          },
        },
      };
    }

    if (env.JETQUEUE_RETRY_MAX_DELAY) {
      config.queue = {
        ...config.queue,
        defaultJobOptions: {
          ...config.queue?.defaultJobOptions,
          retryOptions: {
            ...config.queue?.defaultJobOptions?.retryOptions,
            maxDelay: parseInt(env.JETQUEUE_RETRY_MAX_DELAY, 10),
          },
        },
      };
    }

    // Storage configuration
    if (env.JETQUEUE_STORAGE_TYPE) {
      config.storage = {
        ...config.storage,
        type: env.JETQUEUE_STORAGE_TYPE,
      };
    }

    // PostgreSQL
    if (env.DATABASE_URL || env.JETQUEUE_POSTGRES_CONNECTION_STRING) {
      config.storage = {
        ...config.storage,
        type: "postgres",
        postgres: {
          connectionString:
            env.DATABASE_URL || env.JETQUEUE_POSTGRES_CONNECTION_STRING,
        },
      };
    } else if (env.JETQUEUE_POSTGRES_HOST) {
      config.storage = {
        ...config.storage,
        type: "postgres",
        postgres: {
          host: env.JETQUEUE_POSTGRES_HOST,
          port: env.JETQUEUE_POSTGRES_PORT
            ? parseInt(env.JETQUEUE_POSTGRES_PORT, 10)
            : undefined,
          database: env.JETQUEUE_POSTGRES_DATABASE,
          username: env.JETQUEUE_POSTGRES_USERNAME,
          password: env.JETQUEUE_POSTGRES_PASSWORD,
          schema: env.JETQUEUE_POSTGRES_SCHEMA,
        },
      };
    }

    // Redis
    if (env.REDIS_URL || env.JETQUEUE_REDIS_CONNECTION_STRING) {
      config.storage = {
        ...config.storage,
        type: "redis",
        redis: {
          connectionString:
            env.REDIS_URL || env.JETQUEUE_REDIS_CONNECTION_STRING,
        },
      };
    } else if (env.JETQUEUE_REDIS_HOST) {
      config.storage = {
        ...config.storage,
        type: "redis",
        redis: {
          host: env.JETQUEUE_REDIS_HOST,
          port: env.JETQUEUE_REDIS_PORT
            ? parseInt(env.JETQUEUE_REDIS_PORT, 10)
            : undefined,
          password: env.JETQUEUE_REDIS_PASSWORD,
          db: env.JETQUEUE_REDIS_DB
            ? parseInt(env.JETQUEUE_REDIS_DB, 10)
            : undefined,
          prefix: env.JETQUEUE_REDIS_PREFIX,
          maxRetries: env.JETQUEUE_REDIS_MAX_RETRIES
            ? parseInt(env.JETQUEUE_REDIS_MAX_RETRIES, 10)
            : undefined,
        },
      };
    }

    // SQLite
    if (env.JETQUEUE_SQLITE_FILENAME) {
      config.storage = {
        ...config.storage,
        type: "sqlite",
        sqlite: {
          filename: env.JETQUEUE_SQLITE_FILENAME,
          wal: env.JETQUEUE_SQLITE_WAL
            ? env.JETQUEUE_SQLITE_WAL.toLowerCase() === "true"
            : undefined,
          busyTimeout: env.JETQUEUE_SQLITE_BUSY_TIMEOUT
            ? parseInt(env.JETQUEUE_SQLITE_BUSY_TIMEOUT, 10)
            : undefined,
        },
      };
    }

    // Memory storage
    if (env.JETQUEUE_STORAGE_TYPE === "memory") {
      config.storage = {
        type: "memory",
      };
    }

    return config;
  }

  private mergeDeep(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        // Skip undefined values to prevent overwriting target
        if(source[key] === undefined) return;
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === "object" && !Array.isArray(item);
  }

  getConfig(): JetQueueConfig {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    return this.config;
  }

  /**
   * Get config section for a specific package/plugin
   * Uses type assertion to handle dynamic sections
   */
  getSection<T = any>(section: string): T | undefined {
    if (!this.config) {
      throw new Error("Config not loaded. Call load() first.");
    }
    // Use type assertion to access dynamic sections
    return (this.config as Record<string, any>)[section] as T | undefined;
  }

  /**
   * Get queue configuration
   */
  getQueueConfig() {
    return this.getSection("queue");
  }

  /**
   * Get storage configuration
   */
  getStorageConfig() {
    return this.getSection("storage");
  }

  /**
   * Check if a plugin has configuration
   */
  hasPluginConfig(pluginName: string): boolean {
    if (!this.config) {
      return false;
    }
    return pluginName in (this.config as Record<string, any>);
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig<T = any>(pluginName: string): T | undefined {
    return this.getSection(pluginName);
  }

  validateConfig(config: any): void {
    const schema = getCombinedSchema();
    schema.parse(config);
  }
}

// Convenience function
export async function loadConfig(
  options?: ConfigOptions,
): Promise<JetQueueConfig> {
  return ConfigLoader.getInstance().load(options);
}
