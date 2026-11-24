import { expect, test } from '@playwright/test';
import { sumCurrentNodePower } from '../src/lib/powerSnapshot';

test('fleet output counts the newest sample once per node and accepts measured zero', () => {
  const now = Date.parse('2026-10-21T10:00:00Z');
  expect(sumCurrentNodePower([
    { nodeId: 'a', power: 100, timestamp: '2026-10-21T09:59:50Z' },
    { nodeId: 'a', power: 0, timestamp: '2026-10-21T10:00:00Z' },
    { nodeId: 'b', power: 250, timestamp: '2026-10-21T09:59:55Z' },
    { nodeId: 'stale', power: 9999, timestamp: '2026-10-21T09:58:00Z' },
    { nodeId: 'future', power: 9999, timestamp: '2026-10-21T10:01:00Z' },
    { nodeId: 'invalid', power: NaN, timestamp: 'invalid' }
  ], now)).toBe(250);
});

test('fleet output expires without new readings', () => {
  const sample = { nodeId: 'a', power: 100, timestamp: '2026-10-21T10:00:00Z' };
  expect(sumCurrentNodePower([sample], Date.parse('2026-10-21T10:00:30Z'))).toBe(100);
  expect(sumCurrentNodePower([sample], Date.parse('2026-10-21T10:01:01Z'))).toBe(0);
});
