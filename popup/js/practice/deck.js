import { getWords } from '../../../shared/storage.js';
import { selectDueCards, isDueInMode } from '../../../src/core/selectors.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, hasReviewedWord, refreshReviewedWordDay, getPracticeMode, getIsSubmitting } from './state.js';
import { prioritizeDueCards } from '../../../src/core/learning.js';
import { populateBackFace } from './actions.js';
import { populateFrontFace } from './front_face.js';
import { setupAIHintButton, setupBackAIHintButton, setupAIWritingPractice, setupAISpellingFeedback, triggerSessionSummary, resetCardScope } from './ai_panels.js';

let initialTotalDue = 0;

export async function loadPracticeDeck() {
  refreshReviewedWordDay();
  const words = await getWords();
  const mode = getPracticeMode();
  const reviewedSet = new Set(words.filter(w => hasReviewedWord(w.id, mode)).map(w => w.id));
  const due = prioritizeDueCards(selectDueCards(words, mode, { excludeIds: reviewedSet }), mode);
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
      ? 'Read the word. Remember its meaning before you reveal.'
      : 'Read the clues, listen if you like, then try the spelling.';
  }

  // Update session progress bar
  const fillEl = document.getElementById('practice-progress-fill');
  const progressEl = fillEl?.parentElement;
  if (fillEl) {
    const reviewed = initialTotalDue > 0 ? Math.max(0, initialTotalDue - dueCards.length) : 0;
    const pct = initialTotalDue > 0 ? Math.min(100, Math.round((reviewed / initialTotalDue) * 100)) : 100;
    fillEl.style.width = `${pct}%`;
    progressEl?.setAttribute('aria-valuenow', String(pct));
    document.getElementById('practice-progress-text').textContent = initialTotalDue ? `${reviewed} of ${initialTotalDue} words reviewed` : 'Ready when you are';
  }

  if (dueCards.length === 0) {
    cardEl.classList.add('hidden'); emptyEl.classList.remove('hidden');
    
    // 3-state empty state differentiation
    getWords().then(words => {
      if (getDueCards().length || mode !== getPracticeMode()) return;
      const titleEl = document.getElementById('empty-state-title');
      const msgEl = document.getElementById('empty-state-message');
      if (!titleEl || !msgEl) return;
      if (words.length === 0) {
        titleEl.textContent = 'Your first word is a small beginning.';
        msgEl.textContent = 'Choose a five-word collection on Today, or save a word in Discover.';
      } else {
        const hasModeWords = words.some(w => (w.practiceType || 'both') === mode || (w.practiceType || 'both') === 'both');
        if (!hasModeWords) {
          titleEl.textContent = `No ${mode === 'recall' ? 'meaning' : 'spelling'} cards yet.`;
          msgEl.textContent = 'Try the other mode, or edit a word in your vault to practice both.';
        } else {
          titleEl.textContent = 'Room for a little breathing space.';
          const nextDates = words.filter(w => !w.mastered && ((w.practiceType || 'both') === mode || (w.practiceType || 'both') === 'both')).map(w => mode === 'recall' ? w.meaningNextDate : w.nextDate).filter(date => date > Date.now());
          msgEl.textContent = nextDates.length ? `You’re up to date. Next review: ${new Date(Math.min(...nextDates)).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : 'You’re up to date in this mode. Come back when your next words are due.';
        }
      }
    });

    triggerSessionSummary();
    return;
  }

  cardEl.classList.remove('hidden'); emptyEl.classList.add('hidden');
  cardEl.classList.remove('flipped'); spellInput.value = '';
  cardEl.querySelector('.card-front').inert = false;
  cardEl.querySelector('.card-back').inert = true;
  document.getElementById('practice-save-error')?.classList.add('hidden');
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
  if (getIsSubmitting()) return;
  refreshReviewedWordDay();
  const fresh = await getWords(), now = Date.now(), currentDue = getDueCards();
  if (getIsSubmitting()) return;
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
