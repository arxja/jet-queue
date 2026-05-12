import { describe, test, expect } from 'bun:test';
import { TaskQueue } from '../src/queue';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Retry Logic', () => {
  test('should retry failed jobs with exponential backoff', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let attempts = 0;

    queue.add(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      },
      {
        maxAttempts: 3,
        retryOptions: {
          strategy: 'exponential',
          delay: 10, // Small delay for testing
        },
      }
    );

    // Wait for all retries
    await wait(500);

    expect(attempts).toBe(3);
    expect(queue.getState().completed).toBe(1);
    expect(queue.getState().failed).toBe(0);
  });

  test('should stop retrying after maxAttempts', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let attempts = 0;

    queue.add(
      async () => {
        attempts++;
        throw new Error('Permanent failure');
      },
      {
        maxAttempts: 2,
        retryOptions: {
          strategy: 'fixed',
          delay: 10,
        },
      }
    );

    await wait(500);

    expect(attempts).toBe(2);
    expect(queue.getState().failed).toBe(1);
  });

  test('should emit retry events', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    const retries: number[] = [];

    queue.on('job:retry', (payload: any) => {
      retries.push(payload.attempt);
    });

    queue.add(
      async () => {
        throw new Error('Fail');
      },
      {
        maxAttempts: 3,
        retryOptions: {
          strategy: 'fixed',
          delay: 10,
        },
      }
    );

    await wait(500);

    // Should have retried twice (attempts 2 and 3)
    expect(retries.length).toBe(2);
    expect(retries).toEqual([2, 3]);
  });

  test('should use linear backoff correctly', async () => {
  const queue = new TaskQueue({ concurrency: 1 });
  const delays: number[] = [];
  let firstRetryTime = 0;
  let previousRetryTime = 0;

  queue.on('job:retry', (payload: any) => {
    const now = Date.now();
    if (firstRetryTime === 0) {
      // First retry - measure from job start? Or just record
      firstRetryTime = now;
      previousRetryTime = now;
    } else {
      // Subsequent retries - measure from last retry
      delays.push(now - previousRetryTime);
      previousRetryTime = now;
    }
  });

  queue.add(
    async () => {
      throw new Error('Fail');
    },
    {
      maxAttempts: 4, // Need 4 attempts to get 3 retries
      retryOptions: {
        strategy: 'linear',
        delay: 50, // 50ms base, so: 50, 100, 150
      },
    }
  );

  await wait(500);

  // Should have delays between retries
  expect(delays.length).toBe(2); // Between retry1->retry2 and retry2->retry3
  
  if (delays.length >= 2) {
    // Linear backoff: first interval ~50ms, second ~100ms
    expect(delays[0]).toBeGreaterThanOrEqual(40);
    expect(delays[0]).toBeLessThan(80);
    expect(delays[1]).toBeGreaterThanOrEqual(90);
    expect(delays[1]).toBeLessThan(150);
  }
});
});

describe('Delayed Jobs', () => {
  test('should run job after specified delay', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let executedAt = 0;
    const start = Date.now();

    queue.add(
      async () => {
        executedAt = Date.now();
      },
      { delay: 100 }
    );

    await wait(200);

    const elapsed = executedAt - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow 10ms variance
    expect(queue.getState().completed).toBe(1);
  });

  test('should cancel delayed jobs', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let executed = false;

    const jobId = queue.add(
      async () => {
        executed = true;
      },
      { delay: 1000 }
    );

    const cancelled = queue.cancel(jobId);
    expect(cancelled).toBe(true);

    await wait(100);
    expect(executed).toBe(false);
  });

  test('addDelayed should be a convenience method', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let executed = false;

    queue.addDelayed(
      async () => {
        executed = true;
      },
      50
    );

    await wait(100);
    expect(executed).toBe(true);
  });
});

describe('Progress Tracking', () => {
  test('should track job progress', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    const progressValues: number[] = [];

    queue.on('job:progress', (payload: any) => {
      progressValues.push(payload.progress);
    });

    queue.add(
      async (job: any) => {
        job.reportProgress(25);
        await wait(10);
        job.reportProgress(50);
        await wait(10);
        job.reportProgress(100);
      }
    );

    await wait(100);

    expect(progressValues).toContain(25);
    expect(progressValues).toContain(50);
    expect(progressValues).toContain(100);
  });

  test('should support progress callback in options', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    const progressValues: number[] = [];

    queue.add(
      async (job: any) => {
        job.reportProgress(30);
        job.reportProgress(60);
        job.reportProgress(90);
      },
      {
        onProgress: (job, progress) => {
          progressValues.push(progress);
        },
      }
    );

    await wait(50);

    expect(progressValues).toEqual([30, 60, 90]);
  });
});

describe('Repeating Jobs', () => {
  test('should run job repeatedly at interval', async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    let runCount = 0;

    const { stop } = queue.addRepeating(
      'test-repeating',
      async () => {
        runCount++;
      },
      50
    );

    await wait(120); // Should have run ~2-3 times
    
    const countBeforeStop = runCount;
    stop();
    await wait(100); // Make sure it stopped

    expect(countBeforeStop).toBeGreaterThanOrEqual(2);
    expect(runCount).toBe(countBeforeStop); // Shouldn't have increased after stop
  });
});