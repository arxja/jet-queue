import { z } from "zod";

// Shared defaults
const DEFAULT_RETRY_OPTIONS = {
  strategy: "exponential" as const,
  delay: 1000,
  maxDelay: 60000,
};

const DEFAULT_JOB_OPTIONS = {
  priority: "normal" as const,
  timeout: 30000,
  maxAttempts: 3,
  retryOptions: DEFAULT_RETRY_OPTIONS,
};

// Base schema that all packages extend
const retryOptionsSchema = z
  .object({
    strategy: z.enum(["fixed", "linear", "exponential"]).default("exponential"),
    delay: z.number().positive().default(1000),
    maxDelay: z.number().positive().optional(),
  })
  .default(DEFAULT_RETRY_OPTIONS);

const jobOptionsSchema = z
  .object({
    priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    timeout: z.number().positive().default(30000),
    maxAttempts: z.number().int().positive().default(3),
    retryOptions: retryOptionsSchema.default(DEFAULT_RETRY_OPTIONS),
  })
  .default(DEFAULT_JOB_OPTIONS);
const postgresConfigSchema = z
  .object({
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    connectionString: z.string().optional(),
    pool: z
      .object({
        min: z.number().int().min(0).default(2),
        max: z.number().int().min(1).default(10),
      })
      .optional(),
    schema: z.string().optional(),
  })
  .refine((data) => data.connectionString || (data.host && data.database), {
    message: "Either connectionString or (host + database) is required",
  });

const redisConfigSchema = z
  .object({
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    password: z.string().optional(),
    db: z.number().int().min(0).default(0),
    connectionString: z.string().optional(),
    prefix: z.string().default("jetqueue:"),
    maxRetries: z.number().int().min(0).default(3),
  })
  .refine((data) => data.connectionString || (data.host && data.port), {
    message: "Either connectionString or (host + port) is required",
  });

const sqliteConfigSchema = z.object({
  filename: z.string().default(":memory:"),
  wal: z.boolean().default(true),
  busyTimeout: z.number().positive().default(5000),
});

const storageConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("postgres"),
    postgres: postgresConfigSchema,
  }),
  z.object({
    type: z.literal("redis"),
    redis: redisConfigSchema,
  }),
  z.object({
    type: z.literal("sqlite"),
    sqlite: sqliteConfigSchema,
  }),
  z.object({
    type: z.literal("memory"),
  }),
]);

// Base schema that all packages extend
export const baseConfigSchema = z.object({
  queue: z
    .object({
      concurrency: z
        .number()
        .int()
        .positive("Must be a positive integer")
        .default(5),
      maxQueuedJobs: z.number().int().positive().default(10000),
      autoStart: z.boolean().default(true),
      defaultJobOptions: jobOptionsSchema,
    })
    .default({
      concurrency: 5,
      maxQueuedJobs: 10000,
      autoStart: true,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  storage: storageConfigSchema,
});

// Registry for package schemas
export const configRegistry = new Map<string, z.ZodTypeAny>();

/** Reset the registry – useful for tests */
export function clearConfigRegistry() {
  configRegistry.clear();
}

// Register a package's config schema
export function registerConfigSchema(
  packageName: string,
  schema: z.ZodTypeAny,
) {
  configRegistry.set(packageName, schema);
}

// Get combined schema
function getShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  if (
    schema &&
    typeof schema === "object" &&
    "shape" in schema &&
    typeof schema.shape === "object"
  ) {
    return schema.shape as Record<string, z.ZodTypeAny>;
  }
  return {};
}

export function getCombinedSchema() {
  const schemas = Array.from(configRegistry.values());
  if (schemas.length === 0) {
    return baseConfigSchema;
  }

  // Merge all schemas
  const mergedShape = schemas.reduce(
    (acc, schema) => ({
      ...acc,
      ...getShape(schema),
    }),
    baseConfigSchema.shape,
  );

  return z.object(mergedShape);
}
