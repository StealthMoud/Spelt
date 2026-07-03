import { setOnDeckUpdated, getDueCards, getReviewedWordIds, getPracticeMode, hasReviewedWord, refreshReviewedWordDay, clearReviewedWords } from './practice/state.js';
import { loadPracticeDeck, syncPracticeDeck } from './practice/card.js';
import { registerPracticeListeners } from './practice/listeners.js';
import { registerKeydowns } from './practice/keydowns.js';

export { syncPracticeDeck, loadPracticeDeck, getDueCards, getReviewedWordIds, getPracticeMode, hasReviewedWord, refreshReviewedWordDay, clearReviewedWords };

export async function initPractice(onDeckUpdated) {
  setOnDeckUpdated(onDeckUpdated);
  registerPracticeListeners();
  registerKeydowns();
  await loadPracticeDeck();
}
