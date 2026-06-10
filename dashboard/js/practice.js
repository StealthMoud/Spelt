import { getWords, reviewWord, addXp } from '../../shared/storage.js';

let dueCards = [];
let currentCardIndex = 0;
let onDeckUpdatedCallback = null;
let onXpUpdatedCallback = null;
let triggerConfettiFn = null;
let comboStreak = 0;

export async function initPractice(onDeckUpdated, onXpUpdated, triggerConfetti) {
  onDeckUpdatedCallback = onDeckUpdated;
  onXpUpdatedCallback = onXpUpdated;
  triggerConfettiFn = triggerConfetti;
  
  // Set up event listeners once
  const cardElement = document.getElementById('deck-card');
  const checkBtn = document.getElementById('check-spelling-btn');
  const spellingInput = document.getElementById('spelling-input');
  
  // Submit spelling on click or enter
  checkBtn.addEventListener('click', checkSpelling);
  spellingInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkSpelling();
    }
  });

  // SRS Rating buttons
  const srsBtns = document.querySelectorAll('.srs-btn');
  srsBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const score = parseInt(btn.getAttribute('data-score'), 10);
      await submitRating(score);
    });
  });

  await loadDeck();
}

export async function loadDeck() {
  const words = await getWords();
  const now = Date.now();
  
  // Cards are due if nextDate is in the past
  dueCards = words.filter(w => w.nextDate <= now);
  currentCardIndex = 0;
  
  if (onDeckUpdatedCallback) {
    onDeckUpdatedCallback(dueCards.length);
  }

  showCurrentCard();
}

function showCurrentCard() {
  const cardElement = document.getElementById('deck-card');
  const emptyState = document.getElementById('deck-empty-state');
  const spellingInput = document.getElementById('spelling-input');

  if (dueCards.length === 0 || currentCardIndex >= dueCards.length) {
    cardElement.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  cardElement.style.display = 'block';
  emptyState.style.display = 'none';
  cardElement.classList.remove('flipped');
  spellingInput.value = '';
  spellingInput.focus();

  const card = dueCards[currentCardIndex];

  // Set front clues
  document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
  document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
  document.getElementById('practice-translation').textContent = card.translation || '--';
  
  // Obscure word inside example sentence
  const exampleText = card.example || 'No example sentence added.';
  document.getElementById('practice-example').textContent = blankOutWord(exampleText, card.word);
}

function blankOutWord(sentence, word) {
  if (!sentence || !word) return '';
  // Safe regex escape for special characters in search word
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
  return sentence.replace(regex, '__________');
}

function checkSpelling() {
  const card = dueCards[currentCardIndex];
  if (!card) return;

  const inputVal = document.getElementById('spelling-input').value.trim();
  const isCorrect = inputVal.toLowerCase() === card.word.toLowerCase();

  const resultBadge = document.getElementById('spelling-result-badge');
  const userTyped = document.getElementById('user-typed-display');
  const backWord = document.getElementById('back-word-display');
  const backDef = document.getElementById('back-definition-display');

  // Set correctness badge status and adjust streaks/XP
  if (isCorrect) {
    resultBadge.textContent = 'Correct';
    resultBadge.className = 'result-badge success';
    userTyped.style.color = 'var(--success)';
    
    comboStreak += 1;
    const comboBadge = document.getElementById('combo-badge-container');
    const comboCount = document.getElementById('combo-streak-count');
    if (comboCount) comboCount.textContent = comboStreak;
    if (comboBadge) comboBadge.style.display = 'flex';

    if (triggerConfettiFn) {
      triggerConfettiFn(document.getElementById('check-spelling-btn'));
    }

    addXp(10).then(() => {
      if (onXpUpdatedCallback) onXpUpdatedCallback();
    });
  } else {
    resultBadge.textContent = 'Incorrect';
    resultBadge.className = 'result-badge danger';
    userTyped.style.color = 'var(--danger)';

    comboStreak = 0;
    const comboBadge = document.getElementById('combo-badge-container');
    if (comboBadge) comboBadge.style.display = 'none';

    addXp(2).then(() => {
      if (onXpUpdatedCallback) onXpUpdatedCallback();
    });
  }

  userTyped.textContent = inputVal || '(Blank)';
  backWord.textContent = card.word;
  backDef.textContent = card.definition;

  // Preset highlighted button recommendation
  const srsButtons = document.querySelectorAll('.srs-btn');
  srsButtons.forEach(btn => btn.classList.remove('srs-recommend'));
  
  if (isCorrect) {
    document.querySelector('.srs-good').classList.add('srs-recommend');
  } else {
    document.querySelector('.srs-again').classList.add('srs-recommend');
  }

  // Flip card
  document.getElementById('deck-card').classList.add('flipped');
  
  // Shift focus to next step
  setTimeout(() => {
    document.querySelector('.srs-recommend')?.focus();
  }, 300);
}

async function submitRating(score) {
  const card = dueCards[currentCardIndex];
  if (!card) return;

  try {
    await reviewWord(card.id, score);
    
    // Unflip card, increment, show next
    const cardElement = document.getElementById('deck-card');
    cardElement.classList.remove('flipped');
    
    // Simple delay for flipping transition
    setTimeout(async () => {
      currentCardIndex += 1;
      // reload deck from scratch to keep sync
      await loadDeck();
    }, 300);
  } catch (err) {
    console.error('Failed to log spelling rating:', err);
  }
}
