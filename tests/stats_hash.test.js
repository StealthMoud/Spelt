import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatsHash } from '../src/core/stats_hash.js';

test('buildStatsHash produces correct 14-value fingerprint string', () => {
  const hash = buildStatsHash({
    wordsCount: 15,
    newCount: 3,
    learningCount: 5,
    matureCount: 4,
    masteredCount: 3,
    totalReviews: 42,
    retentionRate: 85,
    currentStreak: 7,
    maxStreak: 12,
    leechesStr: 'accommodate,embarrass',
    sandboxChecks: 20,
    avgResponseTime: 1450,
    totalSessions: 8,
    studyTimeMin: 45
  });

  assert.equal(hash, '15-3-5-4-3-42-85-7-12-accommodate,embarrass-20-1450-8-45');
});

test('buildStatsHash handles default empty parameters gracefully', () => {
  const hash = buildStatsHash();
  assert.equal(hash, '0-0-0-0-0-0-0-0-0--0-0-0-0');
});
