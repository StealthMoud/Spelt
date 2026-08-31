import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackupMetadata, normalizeImportedWord, validateBackupShape } from '../src/data/backup.js';

test('backup words are normalized and bounded', () => {
  const card = normalizeImportedWord({
    word: '  Necessary  ',
    practiceType: 'syntax',
    ef: 99,
    definition: '  needed  ',
    misspellings: [' neccessary ', null],
    history: [{ date: 100, q: 9, interval: -2, mode: 'recall', rt: 99999999 }]
  }, { now: 500, idFactory: () => 'fixed' });

  assert.equal(card.id, 'word_fixed');
  assert.equal(card.word, 'Necessary');
  assert.equal(card.practiceType, 'recall');
  assert.equal(card.ef, 3);
  assert.deepEqual(card.misspellings, ['neccessary']);
  assert.deepEqual(card.history, [{ date: 100, q: 5, interval: 0, mode: 'meaning', rt: 3600000 }]);
});

test('backup validation accepts legacy and full exports', () => {
  assert.deepEqual(validateBackupShape([{ word: 'one' }]), {
    isFullBackup: false,
    words: [{ word: 'one' }]
  });
  assert.deepEqual(validateBackupShape({ words: [{ word: 'two' }] }), {
    isFullBackup: true,
    words: [{ word: 'two' }]
  });
  assert.throws(() => validateBackupShape({ nope: [] }), /not a Spelt backup/);
});

test('backup metadata rejects malformed records and bounds counters', () => {
  const metadata = normalizeBackupMetadata({
    activity: { '2026-08-31': 12, nope: 99 },
    streak: { current: -4, max: 8, lastDate: '2026-08-31' },
    sessions: [null, { startTime: 100, endTime: 200, reviewCount: 5, correctCount: 4 }],
    sandbox_activity: {
      '2026-08-31': { checks: 4, correct: 3, misspelled: 1, notFound: -2 },
      invalid: 'bad'
    }
  });

  assert.deepEqual(metadata.activity, { '2026-08-31': 12 });
  assert.deepEqual(metadata.streak, { current: 0, max: 8, lastDate: '2026-08-31' });
  assert.deepEqual(metadata.sessions, [{ startTime: 100, endTime: 200, reviewCount: 5, correctCount: 4 }]);
  assert.deepEqual(metadata.sandboxActivity, {
    '2026-08-31': { checks: 4, correct: 3, misspelled: 1, notFound: 0 }
  });
});
