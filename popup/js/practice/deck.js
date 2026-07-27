import { getWords } from '../../../shared/storage.js';
import { selectDueCards, isDueInMode } from '../../../src/core/selectors.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, hasReviewedWord, refreshReviewedWordDay, getPracticeMode } from './state.js';
import { populateBackFace } from './actions.js';
import { populateFrontFace } from './front_face.js';
import { setupAIHintButton, setupBackAIHintButton, setupAIWritingPractice, setupAISpellingFeedback, triggerSessionSummary, resetCardScope } from './ai_panels.js';

export async function loadPracticeDeck() {
  refreshReviewedWordDay();
  const words = await getWords();
  const mode = getPracticeMode();
  const reviewedSet = new Set(words.filter(w => hasReviewedWord(w.id, mode)).map(w => w.id));
  setDueCards(selectDueCards(words, mode, { excludeIds: reviewedSet }));
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) {
    cardEl.classList.add('hidden'); emptyEl.classList.remove('hidden');
    triggerSessionSummary();
    return;
  }

  cardEl.classList.remove('hidden'); emptyEl.classList.add('hidden');
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  // Abort previous card's scoped listeners and create fresh scope
  const signal = resetCardScope();

  // Reset AI hint and feedback bubbles
  const hintBubble = document.getElementById('ai-hint-bubble');
  if (hintBubble) hintBubble.classList.add('hidden');
  const backHintBubble = document.getElementById('back-ai-hint-bubble');
  if (backHintBubble) {
    backHintBubble.classList.add('hidden');
    backHintBubble.style.top = 'auto';
    backHintBubble.style.right = '14px';
    backHintBubble.style.bottom = '74px';
    backHintBubble.style.left = '14px';
  }
  const fbBubble = document.getElementById('ai-feedback-row');
  if (fbBubble) {
    fbBubble.classList.add('hidden');
    fbBubble.style.top = 'auto';
    fbBubble.style.right = '14px';
    fbBubble.style.bottom = '74px';
    fbBubble.style.left = '14px';
  }

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
      populateFrontFace(freshCard, signal);
      populateBackFace(freshCard);
    }
  }
}
