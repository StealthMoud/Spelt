import test from 'node:test';
import assert from 'node:assert/strict';
import { calcSM2, computeErrorWeight, getNextReviewDate } from '../src/core/srs.js';

test('calcSM2 calculates interval and ease factor correctly for rating 5', () => {
  const result = calcSM2(5, 1, 1, 2.5);
  assert.equal(result.rep, 2);
  assert.equal(result.interval, 7);
  assert.equal(result.ef, 2.6);
  assert.ok(result.nextDate > Date.now());
});

test('calcSM2 resets interval and repetition on failed rating (<3)', () => {
  const result = calcSM2(2, 3, 10, 2.4);
  assert.equal(result.rep, 0);
  assert.equal(result.interval, 1);
  assert.equal(Number(result.ef.toFixed(2)), 2.08);
});

test('computeErrorWeight calculates penalties and streak recovery', () => {
  assert.equal(computeErrorWeight(0, 0), 1.0);
  const penaltyOnly = computeErrorWeight(2, 0);
  assert.ok(penaltyOnly < 1.0);
  const recovered = computeErrorWeight(2, 2);
  assert.ok(recovered > penaltyOnly);
});

test('getNextReviewDate advances date by given days', () => {
  const now = new Date(2026, 0, 15).getTime();
  const next = getNextReviewDate(3, now);
  const nextDateObj = new Date(next);
  assert.equal(nextDateObj.getDate(), 18);
});
