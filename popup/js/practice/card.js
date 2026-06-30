import { getWords, saveWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, getIsSubmitting, getReviewedWordIds, getPracticeMode } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';

export async function loadPracticeDeck() {
  const words = await getWords();
  const reviewedIds = getReviewedWordIds();
  const mode = getPracticeMode();
  
  if (mode === 'meaning') {
    setDueCards(words.filter(w => w.meaningNextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  } else {
    setDueCards(words.filter(w => w.nextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  }
  
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
  const mode = getPracticeMode();

  const frontSpellingContent = document.getElementById('front-spelling-content');
  const frontMeaningContent = document.getElementById('front-meaning-content');
  const frontSpellingWrapper = document.getElementById('front-spelling-wrapper');
  const frontMeaningWrapper = document.getElementById('front-meaning-wrapper');

  if (mode === 'meaning') {
    if (frontSpellingContent) frontSpellingContent.style.display = 'none';
    if (frontMeaningContent) frontMeaningContent.style.display = 'flex';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'none';
    if (frontMeaningWrapper) frontMeaningWrapper.style.display = 'flex';

    document.getElementById('meaning-front-word').textContent = card.word;
    document.getElementById('meaning-front-transcription').textContent = card.transcription || '/--/';
    const meaningAudio = document.getElementById('meaning-front-audio-container');
    if (meaningAudio) meaningAudio.innerHTML = renderAudioButtons(card.word);
    document.getElementById('meaning-front-pos').textContent = card.partOfSpeech || 'unknown';

    const levelContainer = document.getElementById('meaning-front-level-container');
    const levelEl = document.getElementById('meaning-front-level');
    if (levelContainer && levelEl) {
      let displayLevel = card.level || '';
      levelEl.textContent = displayLevel;
      levelContainer.style.display = displayLevel ? 'inline-block' : 'none';
    }

    // Auto-play pronunciation in Meaning Mode
    setTimeout(() => {
      const activeAudioBtn = document.querySelector('#meaning-front-audio-container .audio-play-btn');
      if (activeAudioBtn) activeAudioBtn.click();
    }, 150);
  } else {
    if (frontSpellingContent) frontSpellingContent.style.display = 'flex';
    if (frontMeaningContent) frontMeaningContent.style.display = 'none';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'flex';
    if (frontMeaningWrapper) frontMeaningWrapper.style.display = 'none';

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

  // Handle Cambridge pronunciation auto-fetch if level doesn't exist
  if (!card.level) {
    fetchCambridgePronunciation(card.word).then(async cambridge => {
      if (cambridge.level) {
        card.level = cambridge.level;
        card.otherLevels = (cambridge.allLevels || []).filter(l => l !== cambridge.level);
        
        // Dynamically update UI in place
        if (mode === 'meaning') {
          const levelEl = document.getElementById('meaning-front-level');
          const levelContainer = document.getElementById('meaning-front-level-container');
          if (levelEl && levelContainer) {
            levelEl.textContent = card.level;
            levelContainer.style.display = 'inline-block';
          }
        } else {
          const levelEl = document.getElementById('practice-level');
          const levelContainer = document.getElementById('practice-level-container');
          if (levelEl && levelContainer) {
            levelEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
            levelContainer.style.display = 'block';
          }
        }
        
        const all = await getWords(), w = all.find(x => x.id === card.id);
        if (w) { w.level = card.level; w.otherLevels = card.otherLevels; await saveWords(all); }
      }
    }).catch(() => {});
  }
}

export async function syncPracticeDeck() {
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
    const isDue = mode === 'meaning' ? f.meaningNextDate <= now : f.nextDate <= now;
    return !f.mastered && isDue && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  const reviewedIds = getReviewedWordIds();
  due.push(...fresh.filter(w => {
    const isDue = mode === 'meaning' ? w.meaningNextDate <= now : w.nextDate <= now;
    return isDue && !w.mastered && !ids.has(w.id) && !reviewedIds.has(w.id);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id, isFlipped = document.getElementById('popup-deck-card')?.classList.contains('flipped');
  if (oldActiveId !== newActiveId || (!isFlipped && !getIsSubmitting())) showPracticeCard();
}
