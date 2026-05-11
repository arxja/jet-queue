/**
 * Generate a unique, sortable job ID
 * Uses timestamp + random string to prevent collisions
 */
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
  return `job_${timestamp}_${random}`;
}

/**
 * Generate a generic unique ID with custom prefix
 * Useful for workers, queues, etc.
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}