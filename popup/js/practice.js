// Compact reviews practice controller for Spelt extension popup
import { getWords, reviewWord, addXp } from '../../shared/storage.js';

let dueCards = [];
let currentIndex = 0;
let onDeckUpdatedCallback = null;

export async function initPractice(onDeckUpdated) {
  onDeckUpdatedCallback = onDeckUpdated;
  
  document.getElementById('check-spelling-btn').addEventListener('click', checkSpelling);
  document.getElementById('spelling-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkSpelling();
    }
  });

  const srsBtns = document.querySelectorAll('#practice-tab .srs-btn');
  srsBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const score = parseInt(btn.getAttribute('data-score'), 10);
      await submitRating(score);
    });
  });

  await loadPracticeDeck();
}

export async function loadPracticeDeck() {
  const words = await getWords();
  const now = Date.now();
  
  dueCards = words.filter(w => w.nextDate <= now);
  currentIndex = 0;
  
  if (onDeckUpdatedCallback) {
    onDeckUpdatedCallback(dueCards.length);
  }
  
  showPracticeCard();
}

function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');

  if (dueCards.length === 0 || currentIndex >= dueCards.length) {
    cardEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    return;
  }

  cardEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped');
  spellInput.value = '';
  spellInput.focus();

  const card = dueCards[currentIndex];
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-translation').textContent = card.translation || '--';
  
  const example = card.example || 'No example sentence added.';
  const escapedWord = card.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('\\b' + escapedWord + '\\b', 'gi');
  document.getElementById('practice-example').textContent = example.replace(regex, '__________');
}

function checkSpelling() {
  const card = dueCards[currentIndex];
  if (!card) return;

  const typed = document.getElementById('spelling-input').value.trim();
  const isOk = typed.toLowerCase() === card.word.toLowerCase();

  const badge = document.getElementById('spelling-result-badge');
  const typedDisplay = document.getElementById('user-typed-display');
  
  if (isOk) {
    badge.textContent = 'Correct';
    badge.className = 'result-badge success';
    typedDisplay.style.color = 'var(--success)';
    addXp(10).then(() => { if (onDeckUpdatedCallback) onDeckUpdatedCallback(dueCards.length - currentIndex); });
  } else {
    badge.textContent = 'Incorrect';
    badge.className = 'result-badge danger';
    typedDisplay.style.color = 'var(--danger)';
    addXp(2).then(() => { if (onDeckUpdatedCallback) onDeckUpdatedCallback(dueCards.length - currentIndex); });
  }

  typedDisplay.textContent = typed || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;

  const pastContainer = document.getElementById('past-misspellings-container');
  const pastDisplay = document.getElementById('back-misspellings-display');
  if (card.misspellings && card.misspellings.length > 0) {
    pastDisplay.textContent = card.misspellings.join(', ');
    pastContainer.style.display = 'block';
  } else {
    pastContainer.style.display = 'none';
  }

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => btn.classList.remove('srs-recommend'));
  if (isOk) {
    document.querySelector('#practice-tab .srs-good').classList.add('srs-recommend');
  } else {
    document.querySelector('#practice-tab .srs-again').classList.add('srs-recommend');
  }

  document.getElementById('popup-deck-card').classList.add('flipped');
  setTimeout(() => {
    document.querySelector('#practice-tab .srs-recommend')?.focus();
  }, 200);
}

async function submitRating(score) {
  const card = dueCards[currentIndex];
  if (!card) return;

  try {
    const typed = document.getElementById('spelling-input').value.trim();
    const isOk = typed.toLowerCase() === card.word.toLowerCase();

    await reviewWord(card.id, score, isOk ? null : typed);
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    
    setTimeout(() => {
      if (score < 3 || !isOk) {
        dueCards.push(card);
      }
      currentIndex += 1;
      if (onDeckUpdatedCallback) {
        onDeckUpdatedCallback(dueCards.length - currentIndex);
      }
      showPracticeCard();
    }, 200);
  } catch (err) {
    console.error(err);
  }
}
