import type { QueueEvent, EventPayload } from './types';

type EventCallback<T extends QueueEvent> = (payload: EventPayload[T]) => void;

export class EventEmitter {
  private listeners: Map<QueueEvent, Set<Function>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * 
   * Example:
   *   queue.on('job:completed', ({ job, result }) => {
   *     console.log(`Job ${job.id} done!`);
   *   });
   */
  on<T extends QueueEvent>(
    event: T,
    callback: EventCallback<T>
  ): void {
    // Get existing listeners for this event, or create new Set
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Subscribe to an event, but only once
   * After first trigger, automatically unsubscribe
   * 
   * Useful for: "Tell me when the queue is idle, just once"
   */
  once<T extends QueueEvent>(
    event: T,
    callback: EventCallback<T>
  ): void {
    // Create a wrapper that removes itself after first call
    const wrapper = ((payload: EventPayload[T]) => {
      this.off(event, wrapper);
      callback(payload);
    }) as EventCallback<T>;

    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends QueueEvent>(
    event: T,
    callback: EventCallback<T>
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit (trigger) an event
   * Calls all subscribed callbacks with the payload
   * 
   * If a callback throws, we catch the error so other
   * callbacks still run (one bad listener doesn't break everything)
   */
  emit<T extends QueueEvent>(
    event: T,
    payload: EventPayload[T]
  ): void {
    const eventListeners = this.listeners.get(event);
    
    if (!eventListeners || eventListeners.size === 0) {
      return; // No one is listening
    }

    // Call each listener, but protect against errors
    eventListeners.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(
          `Error in event handler for "${event}":`,
          error
        );
      }
    });
  }

  /**
   * Remove all listeners for an event (or all events)
   */
  removeAllListeners(event?: QueueEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Check if anyone is listening to an event
   */
  hasListeners(event: QueueEvent): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(event: QueueEvent): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}