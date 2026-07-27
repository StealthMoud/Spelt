import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimestamp, inferPracticeType, summarizeIssueBuckets, runIntegrityAudit } from '../src/data/integrity.js';

test('parseTimestamp parses numbers, strings, and dates', () => {
  const ts = 1700000000000;
  assert.equal(parseTimestamp(ts), ts);
  assert.equal(parseTimestamp(String(ts)), ts);
  assert.equal(parseTimestamp(new Date(ts)), ts);
  assert.equal(parseTimestamp('invalid'), null);
});

test('inferPracticeType determines spelling vs recall based on word length', () => {
  assert.equal(inferPracticeType({ word: 'accommodate' }), 'spelling');
  assert.equal(inferPracticeType({ word: 'kick the bucket' }), 'recall');
});

test('summarizeIssueBuckets sorts issues by count', () => {
  const map = new Map([['A', 2], ['B', 10], ['C', 5]]);
  const summary = summarizeIssueBuckets(map);
  assert.equal(summary[0], 'B (10)');
  assert.equal(summary[1], 'C (5)');
  assert.equal(summary[2], 'A (2)');
});

test('runIntegrityAudit audit mode reports issue count', async () => {
  const report = await runIntegrityAudit({ repair: false });
  assert.equal(typeof report.issueCount, 'number');
  assert.ok(Array.isArray(report.topCategories));
});
