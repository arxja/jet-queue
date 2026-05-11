import { describe, test, expect, beforeEach } from 'bun:test';
import { TaskQueue } from '../src/queue';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue({ concurrency: 2 });
  });

  // Helper: Wait for a short time (for async operations)
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

  describe('Basic Job Execution', () => {
    test('should execute a job and complete it', async () => {
      let executed = false;

      queue.add(async () => {
        executed = true;
        return 'success';
      });

      await wait(10);

      expect(executed).toBe(true);
      expect(queue.getState().completed).toBe(1);
    });

    test('should handle multiple jobs', async () => {
      const results: number[] = [];

      for (let i = 0; i < 3; i++) {
        queue.add(async () => {
          results.push(i);
        });
      }

      await wait(10);

      expect(results.length).toBe(3);
      expect(queue.getState().completed).toBe(3);
    });

    test('should return a job ID', () => {
      const id = queue.add(async () => {});
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.startsWith('job_')).toBe(true);
    });
  });

  describe('Concurrency Control', () => {
    test('should respect concurrency limit', async () => {
      const running: number[] = [];
      const queue = new TaskQueue({ concurrency: 2 });

      // Create 4 jobs that each take 50ms
      for (let i = 0; i < 4; i++) {
        queue.add(async () => {
          running.push(1);
          await wait(50);
          running.pop();
        });
      }

      await wait(5); // Let jobs start
      expect(running.length).toBeLessThanOrEqual(2); // Max 2 at once
      
      await wait(200); // Wait for all to finish
      expect(queue.getState().completed).toBe(4);
    });
  });

  // ! failed
  describe('Job States', () => {
    test('should track pending → running → completed', async () => {
      let stateDuringExecution = '';
      let resolveBlock1, resolveBlock2;
      let resolveTrackedJob;
      
      const blockPromise1 = new Promise(resolve => { resolveBlock1 = resolve; });
      const blockPromise2 = new Promise(resolve => { resolveBlock2 = resolve; });
      
      queue.add(async () => {
        await blockPromise1;
        return 'block1';
      });
      
      queue.add(async () => {
        await blockPromise2;
        return 'block2';
      });
      
      await wait(0);
      
      const trackedJobPromise = new Promise(resolve => { resolveTrackedJob = resolve; });
      
      queue.add(async () => {
        stateDuringExecution = 'running';
        await trackedJobPromise;
        return 'done';
      });
      
      expect(queue.getState().pending).toBe(1);
      expect(queue.getState().running).toBe(2);
      expect(queue.getState().completed).toBe(0);
      
      resolveBlock1();
      await wait(0);
      await wait(0);
      
      expect(stateDuringExecution).toBe('running');
      expect(queue.getState().running).toBe(2);
      expect(queue.getState().pending).toBe(0);
      expect(queue.getState().completed).toBe(1);
      
      resolveTrackedJob();
      await wait(0);
      await wait(0);
      
      expect(queue.getState().running).toBe(1);
      expect(queue.getState().completed).toBe(2);
      
      resolveBlock2();
      await wait(0);
      
      expect(queue.getState().running).toBe(0);
      expect(queue.getState().completed).toBe(3);
    });

    test('should track failed jobs', async () => {
      queue.add(async () => {
        throw new Error('Test error');
      });

      await wait(10);

      expect(queue.getState().failed).toBe(1);
      expect(queue.getState().completed).toBe(0);
    });
  });

  describe('Events', () => {
    test('should emit job:completed event', async () => {
      let completedEvent: any = null;

      queue.on('job:completed', (payload) => {
        completedEvent = payload;
      });

      queue.add(async () => 'result');

      await wait(10);

      expect(completedEvent).toBeTruthy();
      expect(completedEvent.result).toBe('result');
    });

    test('should emit job:failed event', async () => {
      let failedEvent: any = null;

      queue.on('job:failed', (payload) => {
        failedEvent = payload;
      });

      queue.add(async () => {
        throw new Error('oops');
      });

      await wait(10);

      expect(failedEvent).toBeTruthy();
      expect(failedEvent.error.message).toBe('oops');
    });

    test('should emit queue:drain when all done', async () => {
      let drained = false;

      queue.on('queue:drain', () => {
        drained = true;
      });

      queue.add(async () => 'test');

      await wait(10);

      expect(drained).toBe(true);
    });
  });

  describe('Control Methods', () => {
    test('pause should stop processing', async () => {
      let executed = false;

      queue.pause();
      queue.add(async () => {
        executed = true;
      });

      await wait(10);

      expect(executed).toBe(false);
      expect(queue.getState().pending).toBe(1);

      queue.resume();
      await wait(10);

      expect(executed).toBe(true);
    });

    test('cancel should remove pending job', async () => {
      const blockJob1 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
    
      const blockJob2 = queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
      
      await wait(0);
      
      const cancelableId = queue.add(async () => {
        console.log('This should not run');
      });
      
      await wait(0);
      
      expect(queue.getState().pending).toBe(1);
      
      const cancelled = queue.cancel(cancelableId);
      
      expect(cancelled).toBe(true);
      expect(queue.getState().pending).toBe(0);

      // release the blocker jobs so the test doesn't leave timers running
      await queue.shutdown(0);
    });
  });
});