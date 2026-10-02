import { COLLECTIONS } from '../core/collections.js';
import { atomicUpdate } from './storage.js';
import { normalizeImportedWord } from './backup.js';

export async function addCollection(id) {
  const collection = COLLECTIONS.find(item => item.id === id);
  if (!collection) throw new Error('Collection not found.');
  let added = 0;
  await atomicUpdate(words => {
    const existing = new Set(words.map(word => word.word.trim().toLowerCase()));
    for (const [word, partOfSpeech, definition, example, notes] of collection.words) {
      if (existing.has(word)) continue;
      words.push(normalizeImportedWord({ word, partOfSpeech, definition, example, notes,
        tags: [collection.id], practiceType: 'both' }));
      existing.add(word);
      added++;
    }
  });
  return added;
}
