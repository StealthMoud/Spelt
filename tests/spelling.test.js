import test from 'node:test';
import assert from 'node:assert/strict';
import { getLevenshtein, isValidSuggestion } from '../src/core/spelling.js';
import { isAnswerCorrect } from '../popup/js/practice/answer.js';

test('getLevenshtein calculates correct edit distance', () => {
  assert.equal(getLevenshtein('definitely', 'definately'), 1);
  assert.equal(getLevenshtein('color', 'colour'), 1);
  assert.equal(getLevenshtein('same', 'same'), 0);
});

test('isValidSuggestion filters candidates based on prefix match', () => {
  assert.equal(isValidSuggestion('cat', 'bat', 1), true);
  assert.equal(isValidSuggestion('cat', 'dog', 3), false);
});

test('isAnswerCorrect validates exact matches and US/UK spelling variants', () => {
  assert.equal(isAnswerCorrect('color', 'color'), true);
  assert.equal(isAnswerCorrect('colour', 'color'), true);
  assert.equal(isAnswerCorrect('color', 'colour'), true);
  assert.equal(isAnswerCorrect('coluur', 'color'), false);
});
