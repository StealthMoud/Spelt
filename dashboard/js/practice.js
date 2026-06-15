import { getWords, reviewWord, deleteWord, playWordAudio, saveWords, censorWordInExample, getFallbackExample } from '../../shared/storage.js';
import { openFormModal } from './vault.js';

let dueCards = [], currentCardIndex = 0, onDeckUpdatedCallback = null, triggerConfettiFn = null, comboStreak = 0;

export async function initPractice(onDeckUpdated, triggerConfetti) {
  onDeckUpdatedCallback = onDeckUpdated; triggerConfettiFn = triggerConfetti;
  
  document.getElementById('check-spelling-btn')?.addEventListener('click', checkSpelling);
  document.getElementById('spelling-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
  });

  document.querySelectorAll('.practice-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = dueCards[currentCardIndex];
      if (card) openFormModal(card);
    });
  });

  document.querySelectorAll('.srs-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await submitRating(parseInt(btn.getAttribute('data-score'), 10));
    });
  });

  // only allow 1-4 for ratings and space for pronunciation, block other keys untill user rates card
  window.addEventListener('keydown', async (e) => {
    const cardEl = document.getElementById('deck-card');
    if (!cardEl || !cardEl.classList.contains('flipped')) return;

    if (e.key === '1') {
      e.preventDefault();
      e.stopPropagation();
      await submitRating(1);
    } else if (e.key === '2') {
      e.preventDefault();
      e.stopPropagation();
      await submitRating(3);
    } else if (e.key === '3') {
      e.preventDefault();
      e.stopPropagation();
      await submitRating(4);
    } else if (e.key === '4') {
      e.preventDefault();
      e.stopPropagation();
      await submitRating(5);
    } else if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const playBtn = document.querySelector('#back-audio-container .audio-play-btn') || document.querySelector('#deck-card .audio-play-btn');
      if (playBtn) playBtn.click();
    } else {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.getElementById('deck-card')?.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.audio-play-btn');
    if (playBtn) {
      const word = playBtn.getAttribute('data-word');
      const accent = playBtn.getAttribute('data-accent');
      if (word && accent) {
        playWordAudio(word, accent).catch(err => console.error(err));
      }
    }
  });

  await loadDeck();
}

export async function loadDeck() {
  dueCards = (await getWords()).filter(w => w.nextDate <= Date.now() && !w.mastered);
  currentCardIndex = 0;
  onDeckUpdatedCallback?.(dueCards.length);
  showCurrentCard();
}

function showCurrentCard() {
  const cardElement = document.getElementById('deck-card');
  const emptyState = document.getElementById('deck-empty-state');
  const spellingInput = document.getElementById('spelling-input');

  if (dueCards.length === 0 || currentCardIndex >= dueCards.length) {
    cardElement.style.display = 'none'; emptyState.style.display = 'flex'; return;
  }

  cardElement.style.display = 'block'; emptyState.style.display = 'none';
  cardElement.classList.remove('flipped'); spellingInput.value = ''; spellingInput.focus();

  const card = dueCards[currentCardIndex];
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-translation').textContent = card.translation || '--';
  document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

  const exampleContainer = document.getElementById('front-example-container');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    const blankedExample = censorWordInExample(card.word, rawExample);
    document.getElementById('practice-example').textContent = blankedExample;
    exampleContainer.style.display = 'block';
  } else {
    exampleContainer.style.display = 'none';
  }
}

function checkSpelling() {
  const card = dueCards[currentCardIndex];
  if (!card) return;

  const inputVal = document.getElementById('spelling-input').value.trim();
  const isCorrect = inputVal.toLowerCase() === card.word.toLowerCase();
  const resultBadge = document.getElementById('spelling-result-badge');
  const userTyped = document.getElementById('user-typed-display');

  const pastMsgContainer = document.getElementById('past-misspellings-container');
  let displayErrors = card.misspellings ? [...card.misspellings] : [];
  if (!isCorrect && inputVal && !displayErrors.includes(inputVal) && inputVal.toLowerCase() !== card.word.toLowerCase()) {
    displayErrors.push(inputVal);
  }
  if (displayErrors.length > 0) {
    document.getElementById('back-misspellings-display').textContent = displayErrors.join(', ');
    pastMsgContainer.style.display = 'flex';
  } else { pastMsgContainer.style.display = 'none'; }

  if (isCorrect) {
    resultBadge.textContent = 'Correct'; resultBadge.className = 'result-badge success'; userTyped.style.color = 'var(--success)';
    comboStreak += 1;
    const comboBadge = document.getElementById('combo-badge-container');
    if (comboBadge) { comboBadge.style.display = 'flex'; document.getElementById('combo-streak-count').textContent = comboStreak; }
    if (triggerConfettiFn) triggerConfettiFn(document.getElementById('check-spelling-btn'));
  } else {
    resultBadge.textContent = 'Incorrect'; resultBadge.className = 'result-badge danger'; userTyped.style.color = 'var(--danger)';
    comboStreak = 0;
    const comboBadge = document.getElementById('combo-badge-container');
    if (comboBadge) comboBadge.style.display = 'none';
  }

  userTyped.textContent = inputVal || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;
  document.getElementById('back-transcription-display').textContent = card.transcription || '/--/';
  document.getElementById('back-part-of-speech-display').textContent = card.partOfSpeech || 'unknown';

  const backExampleContainer = document.getElementById('back-example-container');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    document.getElementById('back-example-display').textContent = rawExample;
    backExampleContainer.style.display = 'flex';
  } else {
    backExampleContainer.style.display = 'none';
  }

  const audioContainer = document.getElementById('back-audio-container');
  if (audioContainer) {
    audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  document.querySelectorAll('.srs-btn').forEach(btn => btn.classList.remove('srs-recommend'));
  document.querySelector(isCorrect ? '.srs-good' : '.srs-again').classList.add('srs-recommend');

  document.getElementById('deck-card').classList.add('flipped');
  setTimeout(() => { document.querySelector('.srs-recommend')?.focus(); }, 300);
}

async function submitRating(score) {
  const card = dueCards[currentCardIndex];
  if (!card) return;
  try {
    const inputVal = document.getElementById('spelling-input').value.trim();
    const isCorrect = inputVal.toLowerCase() === card.word.toLowerCase();
    
    let updatedCard = null;
    if (isCorrect && score >= 3) {
      // Mark as mastered to preserve errors history in vault
      const list = await getWords();
      const wordObj = list.find(w => w.id === card.id);
      if (wordObj) {
        wordObj.mastered = true;
        wordObj.rep = 0;
        wordObj.interval = 30; // space it out
        await saveWords(list);
      }
    } else {
      updatedCard = await reviewWord(card.id, score, isCorrect ? null : inputVal);
    }
    
    document.getElementById('deck-card').classList.remove('flipped');
    setTimeout(() => {
      if (updatedCard && score < 3) {
        dueCards.push(updatedCard);
      }
      currentCardIndex += 1;
      onDeckUpdatedCallback?.(dueCards.length - currentCardIndex);
      showCurrentCard();
    }, 300);
  } catch (err) { console.error('Failed to log spelling rating:', err); }
}

function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 8px 0 4px;">${b('us', 'US')}${b('uk', 'UK')}</div>`;
}

export async function syncDeck() {
  const freshWords = await getWords();
  const now = Date.now();
  
  dueCards = dueCards.map(card => {
    const fresh = freshWords.find(w => w.id === card.id);
    return fresh ? fresh : card;
  }).filter(card => {
    const fresh = freshWords.find(w => w.id === card.id);
    return fresh && !fresh.mastered;
  });

  const existingIds = new Set(dueCards.map(c => c.id));
  const newDueCards = freshWords.filter(w => 
    w.nextDate <= now && 
    !w.mastered && 
    !existingIds.has(w.id)
  );

  dueCards.push(...newDueCards);
  
  if (currentCardIndex >= dueCards.length && dueCards.length > 0) {
    currentCardIndex = dueCards.length - 1;
  }
  
  onDeckUpdatedCallback?.(dueCards.length - currentCardIndex);
  showCurrentCard();
}
