import test from 'node:test';
import assert from 'node:assert/strict';

const db = {};
let failWrite = false;
globalThis.chrome = {
  runtime: { lastError: null },
  storage: { local: {
    get(key, callback) { queueMicrotask(() => callback({ [key]: structuredClone(db[key]) })); },
    set(values, callback) {
      queueMicrotask(() => {
        if (failWrite) chrome.runtime.lastError = { message: 'Storage quota exceeded' };
        else Object.assign(db, structuredClone(values));
        callback();
        chrome.runtime.lastError = null;
      });
    }
  } }
};
const { addCollection } = await import('../src/data/collections.js');

test('concurrent collection additions do not duplicate or overwrite existing words', async () => {
  db.spelt_words = [{ id: 'personal', word: 'Necessary', notes: 'My own note', history: [{ date: 123, q: 4 }] }];
  const counts = await Promise.all([addCollection('double-letters'), addCollection('double-letters')]);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 4);
  assert.equal(db.spelt_words.length, 5);
  assert.equal(db.spelt_words[0].notes, 'My own note');
  assert.equal(db.spelt_words[0].history.length, 1);
  assert.equal(db.spelt_activity, undefined, 'adding a collection is not a completed review');
});

test('a failed storage write rejects instead of showing a false success', async () => {
  failWrite = true;
  await assert.rejects(addCollection('quiet-letters'), /quota/);
  failWrite = false;
  assert.equal(db.spelt_words.length, 5);
  assert.equal(await addCollection('quiet-letters'), 5, 'a failed write must not block future writes');
});
