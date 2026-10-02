import test from 'node:test';
import assert from 'node:assert/strict';
import { learningSummary, normalizeGoal, prioritizeDueCards } from '../src/core/learning.js';
import { COLLECTIONS } from '../src/core/collections.js';
import { normalizeImportedWord } from '../src/data/backup.js';

const now = new Date(2026, 8, 14, 12).getTime();
test('daily goals count saved reviews, including explicit incorrect answers rated Good', () => {
  const summary = learningSummary([
    { word: 'newly added', practiceType: 'both', history: [] },
    { word: 'reviewed', history: [{ date: now, q: 4, correct: false }, { date: now, q: 4, correct: true }] }
  ], { goal: 5, now });
  assert.equal(summary.reviewed, 2);
  assert.equal(summary.correctToday, 1);
  assert.equal(summary.progress, 40);
  assert.equal(summary.due, 2);
});

test('due counts respect independent tracks, mastery, and future review times', () => {
  const summary = learningSummary([
    { practiceType: 'spelling', nextDate: now + 5000 },
    { practiceType: 'recall', meaningNextDate: 0, nextDate: 0 },
    { practiceType: 'both', mastered: true },
    { practiceType: 'both', nextDate: 0, meaningNextDate: now + 9000 }
  ], { now });
  assert.deepEqual([summary.due, summary.spelling, summary.recall, summary.nextReview], [2, 1, 1, now + 5000]);
});

test('local-day rollover resets the daily goal and expires old streaks', () => {
  const summary = learningSummary([{ history: [{ date: new Date(2026, 8, 13, 23, 59).getTime(), q: 4 }] }],
    { now, streak: { current: 8, lastDate: '2026-09-12' } });
  assert.equal(summary.reviewed, 0);
  assert.equal(summary.streak, 0);
  assert.equal(summary.week[5].count, 1);
  assert.equal(learningSummary([], { now, streak: { current: 8, lastDate: '2026-09-13' } }).streak, 8);
});

test('daily target is bounded and future history is ignored', () => {
  assert.equal(normalizeGoal('20'), 20);
  assert.equal(normalizeGoal(-1), 10);
  assert.equal(learningSummary([{ history: [{ date: now + 1000, q: 4 }] }], { now }).reviewed, 0);
});

test('oldest due reviews come first without mutating the caller deck', () => {
  const cards = [{ id: 'new', nextDate: 100 }, { id: 'old', nextDate: 1 }, { id: 'hard', nextDate: 1, totalErrors: 4 }];
  assert.deepEqual(prioritizeDueCards(cards).map(card => card.id), ['hard', 'old', 'new']);
  assert.equal(cards[0].id, 'new');
});

test('starter collections have unique complete words and memory notes survive import', () => {
  const words = COLLECTIONS.flatMap(collection => collection.words);
  assert.equal(new Set(words.map(word => word[0])).size, 15);
  for (const [word, partOfSpeech, definition, example, notes] of words) {
    assert.ok(example.toLowerCase().includes(word));
    const normalized = normalizeImportedWord({ word, partOfSpeech, definition, example, notes, tags: ['starter'] });
    assert.equal(normalized.notes, notes);
    assert.deepEqual(normalized.tags, ['starter']);
  }
});
