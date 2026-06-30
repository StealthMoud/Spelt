// Practice tab controller orchestrator for Spelt extension popup
import { setOnDeckUpdated, getDueCards } from './practice/state.js';
import { loadPracticeDeck, syncPracticeDeck } from './practice/card.js';
import { registerPracticeListeners } from './practice/listeners.js';
import { registerKeydowns } from './practice/keydowns.js';

export { syncPracticeDeck, loadPracticeDeck, getDueCards };

export async function initPractice(onDeckUpdated) {
  setOnDeckUpdated(onDeckUpdated);
  registerPracticeListeners();
  registerKeydowns();
  await loadPracticeDeck();
}
