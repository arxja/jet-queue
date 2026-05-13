import type { TaskFunction } from "./types";

export class HandlerRegistry {
  private handlers = new Map<string, TaskFunction>();

  register(name: string, fn: TaskFunction): void {
    if (this.handlers.has(name)) {
      throw new Error(`Handler "${name}" is already registered`);
    }
    this.handlers.set(name, fn);
  }

  get(name: string): TaskFunction {
    const fn = this.handlers.get(name);
    if (!fn) {
      throw new Error(`No handler registered for "${name}"`);
    }
    return fn;
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }
}
