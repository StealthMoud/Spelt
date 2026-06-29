import { getWords, saveWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';

export async function loadPracticeDeck() {
  const words = await getWords();
  setDueCards(words.filter(w => w.nextDate <= Date.now() && !w.mastered));
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) { cardEl.style.display = 'none'; emptyEl.style.display = 'flex'; return; }

  cardEl.style.display = 'flex'; emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  const card = dueCards[0];
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

  const transEl = document.getElementById('practice-translation');
  if (transEl) {
    if (card.translation) {
      transEl.innerHTML = `<span class="translation-blur-text">${card.translation}</span><span class="translation-reveal-hint">Reveal</span>`;
      transEl.className = 'translation-clue-box';
      const newEl = transEl.cloneNode(true);
      transEl.parentNode.replaceChild(newEl, transEl);
      newEl.addEventListener('click', () => newEl.classList.add('revealed'));
    } else {
      transEl.textContent = '--'; transEl.className = '';
    }
  }

  const levelContainer = document.getElementById('practice-level-container');
  const levelEl = document.getElementById('practice-level');
  if (levelContainer && levelEl) {
    let displayLevel = card.level || '';
    let otherLevels = card.otherLevels || [];
    levelEl.innerHTML = displayLevel ? formatLevelDisplay(displayLevel, otherLevels) : '';
    levelContainer.style.display = displayLevel ? 'block' : 'none';
    if (!displayLevel) {
      fetchCambridgePronunciation(card.word).then(async cambridge => {
        if (cambridge.level) {
          card.level = cambridge.level;
          card.otherLevels = (cambridge.allLevels || []).filter(l => l !== cambridge.level);
          levelEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
          levelContainer.style.display = 'block';
          const all = await getWords(), w = all.find(x => x.id === card.id);
          if (w) { w.level = card.level; w.otherLevels = card.otherLevels; await saveWords(all); }
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
  } else exampleContainer.style.display = 'none';
  if (exampleTransEl) { exampleTransEl.style.display = 'none'; exampleTransEl.textContent = ''; }
  if (translateBtn) translateBtn.classList.remove('active');

  const audioContainer = document.getElementById('practice-audio-container');
  if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
}

export async function syncPracticeDeck() {
  const fresh = await getWords(), now = Date.now();
  let due = getDueCards().map(c => fresh.find(w => w.id === c.id) || c).filter(c => {
    const f = fresh.find(w => w.id === c.id); return f && !f.mastered && f.nextDate <= now;
  });
  const ids = new Set(due.map(c => c.id));
  due.push(...fresh.filter(w => w.nextDate <= now && !w.mastered && !ids.has(w.id)));
  setDueCards(due); getOnDeckUpdated()?.(); showPracticeCard();
}
