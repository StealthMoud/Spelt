import { getWords, saveWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt } from './state.js';

export function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 4px 0 4px;">${b('us', 'US')}${b('uk', 'UK')}</div>`;
}

export async function loadPracticeDeck() {
  const words = await getWords();
  setDueCards(words.filter(w => w.nextDate <= Date.now() && !w.mastered));
  getOnDeckUpdated()?.();
  showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) {
    cardEl.style.display = 'none'; emptyEl.style.display = 'flex'; return;
  }

  cardEl.style.display = 'flex'; emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  const card = dueCards[0];
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-translation').textContent = card.translation || '--';
  document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

  const levelContainer = document.getElementById('practice-level-container');
  const levelEl = document.getElementById('practice-level');
  if (levelContainer && levelEl) {
    levelEl.textContent = card.level || '';
    levelContainer.style.display = card.level ? 'block' : 'none';
    if (!card.level) {
      fetchCambridgePronunciation(card.word).then(async cambridge => {
        if (cambridge.level) {
          card.level = cambridge.level; levelEl.textContent = card.level; levelContainer.style.display = 'block';
          const all = await getWords(), w = all.find(x => x.id === card.id);
          if (w) { w.level = card.level; await saveWords(all); }
        }
      }).catch(() => {});
    }
  }

  const exampleContainer = document.getElementById('practice-example-container');
  const exampleTransEl = document.getElementById('practice-example-translation');
  const translateBtn = document.getElementById('practice-translate-btn');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    document.getElementById('practice-example').textContent = censorWordInExample(card.word, rawExample);
    exampleContainer.style.display = 'block';
  } else {
    exampleContainer.style.display = 'none';
  }
  if (exampleTransEl) { exampleTransEl.style.display = 'none'; exampleTransEl.textContent = ''; }
  if (translateBtn) translateBtn.classList.remove('active');

  const audioContainer = document.getElementById('practice-audio-container');
  if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
}

export async function syncPracticeDeck() {
  const freshWords = await getWords();
  const now = Date.now();
  let dueCards = getDueCards();
  
  dueCards = dueCards.map(card => {
    const fresh = freshWords.find(w => w.id === card.id);
    return fresh ? fresh : card;
  }).filter(card => {
    const fresh = freshWords.find(w => w.id === card.id);
    return fresh && !fresh.mastered && fresh.nextDate <= now;
  });

  const existingIds = new Set(dueCards.map(c => c.id));
  const newDueCards = freshWords.filter(w => 
    w.nextDate <= now && !w.mastered && !existingIds.has(w.id)
  );

  dueCards.push(...newDueCards);
  setDueCards(dueCards);
  
  getOnDeckUpdated()?.();
  showPracticeCard();
}
