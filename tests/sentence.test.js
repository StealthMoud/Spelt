import test from 'node:test';
import assert from 'node:assert/strict';
import { isFallbackExample, getFallbackExample, censorWordInExample } from '../shared/storage/sentence.js';

test('getFallbackExample and isFallbackExample are in sync', () => {
  const exNoun = getFallbackExample('apple', 'noun');
  const exVerb = getFallbackExample('run', 'verb');
  assert.equal(isFallbackExample('apple', exNoun), true);
  assert.equal(isFallbackExample('run', exVerb), true);
  assert.equal(isFallbackExample('apple', 'I ate a sweet red apple in the garden.'), false);
});

test('censorWordInExample censors word and inflections', () => {
  assert.equal(censorWordInExample('accommodate', 'The room can accommodate ten people.'), 'The room can __________ ten people.');
});
