import { describe, test, expect } from 'bun:test';
import { generateJobId, generateId } from '../src/utils/uid';
import { PRIORITY_ORDER } from '../src/types';

describe('generateJobId', () => {
  test('should create unique IDs', () => {
    const ids = new Set(
      Array.from({ length: 1000 }, () => generateJobId())
    );
    
    // All 1000 IDs should be unique
    expect(ids.size).toBe(1000);
  });

  test('should start with "job_"', () => {
    const id = generateJobId();
    expect(id.startsWith('job_')).toBe(true);
  });

  test('should be sortable by creation time', async () => {
    const id1 = generateJobId();
    await new Promise(r => setTimeout(r, 10));
    const id2 = generateJobId();
    
    // id2 should be "greater" since it was created later
    expect(id2 > id1).toBe(true);
  });
});

describe('PRIORITY_ORDER', () => {
  test('critical should have highest priority', () => {
    expect(PRIORITY_ORDER.critical).toBe(0);
  });

  test('low should have lowest priority', () => {
    expect(PRIORITY_ORDER.low).toBe(3);
  });

  test('higher priority should have lower number', () => {
    expect(PRIORITY_ORDER.critical).toBeLessThan(PRIORITY_ORDER.high);
    expect(PRIORITY_ORDER.high).toBeLessThan(PRIORITY_ORDER.normal);
    expect(PRIORITY_ORDER.normal).toBeLessThan(PRIORITY_ORDER.low);
  });
});

describe('generateId', () => {
  test('should use custom prefix', () => {
    const id = generateId('worker');
    expect(id.startsWith('worker_')).toBe(true);
  });
});