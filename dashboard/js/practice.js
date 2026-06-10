import { getWords, reviewWord, addXp } from '../../shared/storage.js';

let dueCards = [], currentCardIndex = 0, onDeckUpdatedCallback = null, onXpUpdatedCallback = null, triggerConfettiFn = null, comboStreak = 0;

export async function initPractice(onDeckUpdated, onXpUpdated, triggerConfetti) {
  onDeckUpdatedCallback = onDeckUpdated; onXpUpdatedCallback = onXpUpdated; triggerConfettiFn = triggerConfetti;
  
  document.getElementById('check-spelling-btn')?.addEventListener('click', checkSpelling);
  document.getElementById('spelling-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
  });

  document.querySelectorAll('.srs-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await submitRating(parseInt(btn.getAttribute('data-score'), 10));
    });
  });

  window.addEventListener('keydown', async (e) => {
    const cardEl = document.getElementById('deck-card');
    if (!cardEl || !cardEl.classList.contains('flipped')) return;
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (e.key === '1') { e.preventDefault(); await submitRating(1); }
    else if (e.key === '2') { e.preventDefault(); await submitRating(3); }
    else if (e.key === '3') { e.preventDefault(); await submitRating(4); }
    else if (e.key === '4') { e.preventDefault(); await submitRating(5); }
  });

  await loadDeck();
}

export async function loadDeck() {
  dueCards = (await getWords()).filter(w => w.nextDate <= Date.now());
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
  document.getElementById('practice-example').textContent = blankOutWord(card.example || 'No example sentence added.', card.word);
}

function blankOutWord(sentence, word) {
  if (!sentence || !word) return '';
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return sentence.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), '__________');
}

function checkSpelling() {
  const card = dueCards[currentCardIndex];
  if (!card) return;

  const inputVal = document.getElementById('spelling-input').value.trim();
  const isCorrect = inputVal.toLowerCase() === card.word.toLowerCase();
  const resultBadge = document.getElementById('spelling-result-badge');
  const userTyped = document.getElementById('user-typed-display');

  const pastMsgContainer = document.getElementById('past-misspellings-container');
  if (card.misspellings && card.misspellings.length > 0) {
    document.getElementById('back-misspellings-display').textContent = card.misspellings.join(', ');
    pastMsgContainer.style.display = 'flex';
  } else { pastMsgContainer.style.display = 'none'; }

  if (isCorrect) {
    resultBadge.textContent = 'Correct'; resultBadge.className = 'result-badge success'; userTyped.style.color = 'var(--success)';
    comboStreak += 1;
    const comboBadge = document.getElementById('combo-badge-container');
    if (comboBadge) { comboBadge.style.display = 'flex'; document.getElementById('combo-streak-count').textContent = comboStreak; }
    if (triggerConfettiFn) triggerConfettiFn(document.getElementById('check-spelling-btn'));
    addXp(10).then(() => onXpUpdatedCallback?.());
  } else {
    resultBadge.textContent = 'Incorrect'; resultBadge.className = 'result-badge danger'; userTyped.style.color = 'var(--danger)';
    comboStreak = 0;
    const comboBadge = document.getElementById('combo-badge-container');
    if (comboBadge) comboBadge.style.display = 'none';
    addXp(2).then(() => onXpUpdatedCallback?.());
  }

  userTyped.textContent = inputVal || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;

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
    await reviewWord(card.id, score, isCorrect ? null : inputVal);
    
    document.getElementById('deck-card').classList.remove('flipped');
    setTimeout(() => {
      if (score < 3 || !isCorrect) dueCards.push(card);
      currentCardIndex += 1;
      onDeckUpdatedCallback?.(dueCards.length - currentCardIndex);
      showCurrentCard();
    }, 300);
  } catch (err) { console.error('Failed to log spelling rating:', err); }
}
