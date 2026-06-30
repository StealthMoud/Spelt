import { getWords, saveWords } from './core.js';
import { calcSM2, computeErrorWeight } from './srs.js';
import { logActivity } from './sessions.js';

// Update word SRS parameters based on review score
// responseTimeMs: optional ms elapsed from card shown to rating submitted
export async function reviewWord(wordId, q, typedWrongWord = null, responseTimeMs = null, mode = 'spelling') {
  const list = await getWords();
  const index = list.findIndex(w => w.id === wordId);
  if (index === -1) throw new Error('Word not found');

  const card = list[index];

  // Ensure backward compatibility for words created before error-weight fields existed
  if (card.totalErrors === undefined) card.totalErrors = (card.misspellings || []).length;
  if (card.correctStreak === undefined) card.correctStreak = 0;

  if (mode === 'meaning') {
    const isCorrect = q >= 3;
    const { rep, interval, ef, nextDate } = calcSM2(
      q,
      card.meaningRep || 0,
      card.meaningInterval || 0,
      card.meaningEf || 2.5,
      1.0,
      isCorrect,
      1.0
    );

    card.meaningRep = rep;
    card.meaningInterval = interval;
    card.meaningEf = ef;
    card.meaningNextDate = nextDate;
    card.meaningLastReviewedAt = Date.now();

    const historyEntry = { date: Date.now(), q, interval, mode: 'meaning' };
    if (responseTimeMs !== null && responseTimeMs > 0) {
      historyEntry.rt = responseTimeMs;
    }
    card.history.push(historyEntry);
  } else {
    const isCorrect = (typedWrongWord === null || typedWrongWord === undefined);
    // Compute error weight from accumulated difficulty history
    const errorWeight = computeErrorWeight(card.totalErrors, card.correctStreak);
    const { rep, interval, ef, nextDate } = calcSM2(q, card.rep, card.interval, card.ef, 1.0, isCorrect, errorWeight);

    card.rep = rep;
    card.interval = interval;
    card.ef = ef;
    card.nextDate = nextDate;
    card.lastReviewedAt = Date.now();
    const historyEntry = { date: Date.now(), q, interval, mode: 'spelling' };
    if (responseTimeMs !== null && responseTimeMs > 0) {
      historyEntry.rt = responseTimeMs;
    }
    card.history.push(historyEntry);

    if (typedWrongWord !== null && typedWrongWord !== undefined) {
      // Incorrect spelling during practice
      if (!card.misspellings) card.misspellings = [];
      if (typedWrongWord.toLowerCase() !== card.word.toLowerCase()) {
        card.misspellings.push(typedWrongWord);
      }
      card.totalErrors = (card.totalErrors || 0) + 1;
      card.correctStreak = 0;
    } else {
      // Correct spelling — graduated forgiveness: require 3 consecutive correct
      // reviews before clearing misspellings (prevents accidental/lucky clears)
      card.correctStreak = (card.correctStreak || 0) + 1;
      if (card.correctStreak >= 3) {
        card.misspellings = [];
        // Note: totalErrors is never reset — it's the permanent difficulty memory
      }
    }
  }

  await saveWords(list);
  await logActivity();
  return card;
}
