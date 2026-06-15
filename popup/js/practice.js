import { getWords, reviewWord, deleteWord, playWordAudio, saveWords, censorWordInExample, getFallbackExample } from '../../shared/storage.js';
import { openModal } from './vault.js';

let dueCards = [], currentIndex = 0, onDeckUpdatedCallback = null;

export async function initPractice(onDeckUpdated) {
  onDeckUpdatedCallback = onDeckUpdated;
  
  document.getElementById('check-spelling-btn')?.addEventListener('click', checkSpelling);
  document.getElementById('spelling-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
  });

  document.querySelectorAll('.practice-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = dueCards[currentIndex];
      if (card) openModal(card);
    });
  });

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scoreAttr = btn.getAttribute('data-score');
      if (scoreAttr === 'mastered') {
        const card = dueCards[currentIndex];
        if (!card) return;
        const confirmTitle = 'Mark as Mastered?';
        const confirmMsg = `Are you sure you want to mark "${card.word}" as Mastered? This will archive it and remove it from your active reviews.`;
        
        const modal = document.getElementById('popup-confirm-modal');
        if (modal) {
          document.getElementById('popup-confirm-title').textContent = confirmTitle;
          document.getElementById('popup-confirm-msg').textContent = confirmMsg;
          
          const confirmBtn = document.getElementById('popup-confirm-ok-btn');
          const cancelBtn = document.getElementById('popup-confirm-cancel-btn');
          
          const onConfirm = async () => {
            modal.style.display = 'none';
            cleanup();
            await submitMasteredRating(card);
          };
          const onCancel = () => {
            modal.style.display = 'none';
            cleanup();
          };
          const cleanup = () => {
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
          };
          
          confirmBtn.addEventListener('click', onConfirm);
          cancelBtn.addEventListener('click', onCancel);
          modal.style.display = 'flex';
        } else {
          if (confirm(confirmMsg)) {
            await submitMasteredRating(card);
          }
        }
      } else {
        await submitRating(parseInt(scoreAttr, 10));
      }
    });
  });

  // only allow 1-5 for ratings and space for pronunciation, block other keys untill user rates card
  window.addEventListener('keydown', async (e) => {
    const cardEl = document.getElementById('popup-deck-card');
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
    } else if (e.key === '5') {
      e.preventDefault();
      e.stopPropagation();
      const masteredBtn = document.querySelector('#practice-tab .srs-mastered');
      if (masteredBtn) masteredBtn.click();
    } else if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const playBtn = document.querySelector('#back-audio-container .audio-play-btn') || document.querySelector('#popup-deck-card .audio-play-btn');
      if (playBtn) playBtn.click();
    } else {
      // Allow confirming the modal via Enter/Space if confirm modal is active
      const modal = document.getElementById('popup-confirm-modal');
      if (modal && modal.style.display === 'flex') {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('popup-confirm-ok-btn')?.click();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('popup-confirm-cancel-btn')?.click();
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.getElementById('popup-deck-card')?.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.audio-play-btn');
    if (playBtn) {
      const word = playBtn.getAttribute('data-word');
      const accent = playBtn.getAttribute('data-accent');
      if (word && accent) {
        playWordAudio(word, accent).catch(err => console.error(err));
      }
    }
  });

  await loadPracticeDeck();
}

export async function loadPracticeDeck() {
  dueCards = (await getWords()).filter(w => w.nextDate <= Date.now() && !w.mastered);
  currentIndex = 0;
  onDeckUpdatedCallback?.(dueCards.length);
  showPracticeCard();
}

function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');

  if (dueCards.length === 0 || currentIndex >= dueCards.length) {
    cardEl.style.display = 'none'; emptyEl.style.display = 'flex'; return;
  }

  cardEl.style.display = 'flex'; emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped'); spellInput.value = ''; spellInput.focus();

  const card = dueCards[currentIndex];
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-translation').textContent = card.translation || '--';
  document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

  const exampleContainer = document.getElementById('practice-example-container');
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
  const card = dueCards[currentIndex];
  if (!card) return;

  const typed = document.getElementById('spelling-input').value.trim();
  const isOk = typed.toLowerCase() === card.word.toLowerCase();
  const badge = document.getElementById('spelling-result-badge');
  const typedDisplay = document.getElementById('user-typed-display');
  
  if (isOk) {
    badge.textContent = 'Correct'; badge.className = 'result-badge success'; typedDisplay.style.color = 'var(--success)';
  } else {
    badge.textContent = 'Incorrect'; badge.className = 'result-badge danger'; typedDisplay.style.color = 'var(--danger)';
  }
  onDeckUpdatedCallback?.(dueCards.length - currentIndex);

  typedDisplay.textContent = typed || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;
  document.getElementById('back-transcription-display').textContent = card.transcription || '/--/';
  document.getElementById('back-part-of-speech-display').textContent = card.partOfSpeech || 'unknown';

  const backExampleContainer = document.getElementById('back-example-container');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    document.getElementById('back-example-display').textContent = rawExample;
    backExampleContainer.style.display = 'block';
  } else {
    backExampleContainer.style.display = 'none';
  }

  const audioContainer = document.getElementById('back-audio-container');
  if (audioContainer) {
    audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  const pastContainer = document.getElementById('past-misspellings-container');
  let displayErrors = card.misspellings ? [...card.misspellings] : [];
  if (!isOk && typed && !displayErrors.includes(typed) && typed.toLowerCase() !== card.word.toLowerCase()) {
    displayErrors.push(typed);
  }
  if (displayErrors.length > 0) {
    document.getElementById('back-misspellings-display').textContent = displayErrors.join(', ');
    pastContainer.style.display = 'block';
  } else { pastContainer.style.display = 'none'; }

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => btn.classList.remove('srs-recommend'));
  document.querySelector(isOk ? '#practice-tab .srs-good' : '#practice-tab .srs-again').classList.add('srs-recommend');

  document.getElementById('popup-deck-card').classList.add('flipped');
  setTimeout(() => { document.querySelector('#practice-tab .srs-recommend')?.focus(); }, 200);
}

async function submitRating(score) {
  const card = dueCards[currentIndex];
  if (!card) return;
  try {
    const typed = document.getElementById('spelling-input').value.trim();
    const isOk = typed.toLowerCase() === card.word.toLowerCase();
    
    let updatedCard = null;
    if (isOk && score === 5) {
      // Mark as mastered to preserve errors history in vault
      const list = await getWords();
      const wordObj = list.find(w => w.id === card.id);
      if (wordObj) {
        wordObj.mastered = true;
        wordObj.rep = 0;
        wordObj.interval = 30; // space it out
        wordObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
        await saveWords(list);
      }
    } else {
      updatedCard = await reviewWord(card.id, score, isOk ? null : typed);
    }
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      if (updatedCard && score < 3) {
        dueCards.push(updatedCard);
      }
      currentIndex += 1;
      onDeckUpdatedCallback?.(dueCards.length - currentIndex);
      showPracticeCard();
    }, 200);
  } catch (err) { console.error(err); }
}

async function submitMasteredRating(card) {
  try {
    const list = await getWords();
    const wordObj = list.find(w => w.id === card.id);
    if (wordObj) {
      wordObj.mastered = true;
      wordObj.rep = 0;
      wordObj.interval = 30; // space it out
      wordObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await saveWords(list);
    }
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      currentIndex += 1;
      onDeckUpdatedCallback?.(dueCards.length - currentIndex);
      showPracticeCard();
    }, 200);
  } catch (err) { console.error(err); }
}

function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 4px 0 4px;">${b('us', 'US')}${b('uk', 'UK')}</div>`;
}

export async function syncPracticeDeck() {
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
  
  if (currentIndex >= dueCards.length && dueCards.length > 0) {
    currentIndex = dueCards.length - 1;
  }
  
  onDeckUpdatedCallback?.(dueCards.length - currentIndex);
  showPracticeCard();
}
