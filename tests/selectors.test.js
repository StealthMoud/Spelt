import test from 'node:test';
import assert from 'node:assert/strict';
import { isDueInMode, selectDueCards } from '../src/core/selectors.js';

test('isDueInMode checks mode and due date correctly', () => {
  const now = Date.now();
  const cardSpelling = { id: '1', nextDate: now - 1000, practiceType: 'spelling', mastered: false };
  const cardRecall = { id: '2', meaningNextDate: now - 1000, practiceType: 'recall', mastered: false };
  const cardFuture = { id: '3', nextDate: now + 100000, practiceType: 'spelling', mastered: false };

  assert.equal(isDueInMode(cardSpelling, 'spelling', now), true);
  assert.equal(isDueInMode(cardSpelling, 'recall', now), false);
  assert.equal(isDueInMode(cardRecall, 'recall', now), true);
  assert.equal(isDueInMode(cardFuture, 'spelling', now), false);
});

test('selectDueCards filters words and excludes specified IDs', () => {
  const now = Date.now();
  const words = [
    { id: 'w1', nextDate: now - 500, practiceType: 'spelling' },
    { id: 'w2', nextDate: now - 500, practiceType: 'spelling' },
    { id: 'w3', nextDate: now + 500, practiceType: 'spelling' }
  ];

  const due = selectDueCards(words, 'spelling', { excludeIds: new Set(['w1']) });
  assert.equal(due.length, 1);
  assert.equal(due[0].id, 'w2');
});
