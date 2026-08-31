import { getWords } from '../../../shared/storage.js';
import { selectDueCards, isDueInMode } from '../../../src/core/selectors.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, hasReviewedWord, refreshReviewedWordDay, getPracticeMode } from './state.js';
import { populateBackFace } from './actions.js';
import { populateFrontFace } from './front_face.js';
import { setupAIHintButton, setupBackAIHintButton, setupAIWritingPractice, setupAISpellingFeedback, triggerSessionSummary, resetCardScope } from './ai_panels.js';

let initialTotalDue = 0;

export async function loadPracticeDeck() {
  refreshReviewedWordDay();
  const words = await getWords();
  const mode = getPracticeMode();
  const reviewedSet = new Set(words.filter(w => hasReviewedWord(w.id, mode)).map(w => w.id));
  const due = selectDueCards(words, mode, { excludeIds: reviewedSet });
  setDueCards(due);
  initialTotalDue = due.length;
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();
  const mode = getPracticeMode();

  // Update mode description
  const descEl = document.getElementById('practice-mode-description');
  if (descEl) {
    descEl.textContent = mode === 'recall'
      ? 'Recall: View word, test memory, then reveal answer.'
      : 'Spelling: Hear audio clues and type the exact spelling.';
  }

  // Update session progress bar
  const fillEl = document.getElementById('practice-progress-fill');
  const progressEl = fillEl?.parentElement;
  if (fillEl) {
    const reviewed = initialTotalDue > 0 ? Math.max(0, initialTotalDue - dueCards.length) : 0;
    const pct = initialTotalDue > 0 ? Math.min(100, Math.round((reviewed / initialTotalDue) * 100)) : 100;
    fillEl.style.width = `${pct}%`;
    progressEl?.setAttribute('aria-valuenow', String(pct));
  }

  if (dueCards.length === 0) {
    cardEl.classList.add('hidden'); emptyEl.classList.remove('hidden');
    
    // 3-state empty state differentiation
    getWords().then(words => {
      const titleEl = document.getElementById('empty-state-title');
      const msgEl = document.getElementById('empty-state-message');
      if (!titleEl || !msgEl) return;
      if (words.length === 0) {
        titleEl.textContent = 'Vault Empty!';
        msgEl.textContent = 'Add words in Sandbox to start practicing.';
      } else {
        const hasModeWords = words.some(w => (w.practiceType || 'spelling') === mode || (w.practiceType || 'spelling') === 'both');
        if (!hasModeWords) {
          titleEl.textContent = 'No Cards for This Mode!';
          msgEl.textContent = 'No words saved for this practice mode yet. Add words or switch mode.';
        } else {
          titleEl.textContent = 'Deck Fully Reviewed!';
          msgEl.textContent = 'You cleared all scheduled reviews for today!';
        }
      }
    });

    triggerSessionSummary();
    return;
  }

  cardEl.classList.remove('hidden'); emptyEl.classList.add('hidden');
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  // Abort previous card's scoped listeners and create fresh scope
  const signal = resetCardScope();

  // Reset bottom sheet
  const bottomSheet = document.getElementById('practice-bottom-sheet');
  if (bottomSheet) bottomSheet.classList.add('hidden');

  const card = dueCards[0];

  // Show AI components if configured
  setupAIHintButton(card, signal);
  setupBackAIHintButton(card, signal);
  setupAIWritingPractice(card, signal);
  setupAISpellingFeedback(signal);

  populateFrontFace(card, signal);
}

export async function syncPracticeDeck() {
  refreshReviewedWordDay();
  const fresh = await getWords(), now = Date.now(), currentDue = getDueCards();
  const activeCard = currentDue[0], oldActiveId = activeCard?.id;
  const mode = getPracticeMode();
  let due = [];
  if (activeCard) {
    const freshActive = fresh.find(w => w.id === activeCard.id);
    if (freshActive) due.push(freshActive);
  }
  const activeId = activeCard ? activeCard.id : null;
  const restDue = currentDue.slice(1).map(c => fresh.find(w => w.id === c.id) || c).filter(c => {
    const f = fresh.find(w => w.id === c.id);
    if (!f) return false;
    return isDueInMode(f, mode, now) && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  due.push(...fresh.filter(w => {
    return isDueInMode(w, mode, now) && !ids.has(w.id) && !hasReviewedWord(w.id, mode);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id;
  if (oldActiveId !== newActiveId) {
    showPracticeCard();
  } else if (newActiveId) {
    const signal = resetCardScope();
    const freshCard = fresh.find(w => w.id === newActiveId);
    if (freshCard) {
      // resetCardScope aborted the AI panel listeners, so re-mount them here
      // too — otherwise the hint/writing buttons go dead after any sync.
      setupAIHintButton(freshCard, signal);
      setupBackAIHintButton(freshCard, signal);
      setupAIWritingPractice(freshCard, signal);
      setupAISpellingFeedback(signal);
      populateFrontFace(freshCard, signal);
      populateBackFace(freshCard);
    }
  }
}
