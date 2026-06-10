// Compact reviews practice controller for Spelt extension popup
import { getWords, reviewWord, addXp } from '../../shared/storage.js';

let dueCards = [], currentIndex = 0, onDeckUpdatedCallback = null;

export async function initPractice(onDeckUpdated) {
  onDeckUpdatedCallback = onDeckUpdated;
  
  document.getElementById('check-spelling-btn')?.addEventListener('click', checkSpelling);
  document.getElementById('spelling-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
  });

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await submitRating(parseInt(btn.getAttribute('data-score'), 10));
    });
  });

  window.addEventListener('keydown', async (e) => {
    const cardEl = document.getElementById('popup-deck-card');
    if (!cardEl || !cardEl.classList.contains('flipped')) return;
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (e.key === '1') { e.preventDefault(); await submitRating(1); }
    else if (e.key === '2') { e.preventDefault(); await submitRating(3); }
    else if (e.key === '3') { e.preventDefault(); await submitRating(4); }
    else if (e.key === '4') { e.preventDefault(); await submitRating(5); }
  });

  document.getElementById('popup-deck-card')?.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-audio-url]');
    if (playBtn) {
      const url = playBtn.getAttribute('data-audio-url');
      if (url) new Audio(url).play().catch(err => console.error(err));
    }
  });

  await loadPracticeDeck();
}

export async function loadPracticeDeck() {
  dueCards = (await getWords()).filter(w => w.nextDate <= Date.now());
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
  
  const example = card.example || 'No example sentence added.';
  const escapedWord = card.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  document.getElementById('practice-example').textContent = example.replace(new RegExp('\\b' + escapedWord + '\\b', 'gi'), '__________');
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
    addXp(10).then(() => onDeckUpdatedCallback?.(dueCards.length - currentIndex));
  } else {
    badge.textContent = 'Incorrect'; badge.className = 'result-badge danger'; typedDisplay.style.color = 'var(--danger)';
    addXp(2).then(() => onDeckUpdatedCallback?.(dueCards.length - currentIndex));
  }

  typedDisplay.textContent = typed || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;
  document.getElementById('back-transcription-display').textContent = card.transcription || '/--/';

  const audioContainer = document.getElementById('back-audio-container');
  if (audioContainer) {
    audioContainer.innerHTML = '';
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(card.word.toLowerCase())}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data[0] && data[0].phonetics) {
          const { us, uk } = extractAudios(data[0].phonetics);
          audioContainer.innerHTML = renderAudioButtons(us, uk);
        }
      })
      .catch(err => console.error(err));
  }

  const pastContainer = document.getElementById('past-misspellings-container');
  if (card.misspellings && card.misspellings.length > 0) {
    document.getElementById('back-misspellings-display').textContent = card.misspellings.join(', ');
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
    const updatedCard = await reviewWord(card.id, score, isOk ? null : typed);
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      if (score < 3 || !isOk) dueCards.push(updatedCard);
      currentIndex += 1;
      onDeckUpdatedCallback?.(dueCards.length - currentIndex);
      showPracticeCard();
    }, 200);
  } catch (err) { console.error(err); }
}

function extractAudios(ph) {
  const audios = ph ? ph.map(p => p.audio).filter(Boolean) : [];
  const us = audios.find(a => a.includes('-us') || a.includes('/us/')) || audios[0] || '';
  const uk = audios.find(a => a.includes('-uk') || a.includes('/uk/')) || audios[1] || us;
  return { us, uk };
}

function renderAudioButtons(us, uk) {
  const b = (u, l) => u ? `<button type="button" class="audio-play-btn" data-audio-url="${u}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${l}</span></button>` : '';
  return (us || uk) ? `<div style="display: flex; gap: 6px; margin: 4px 0 4px;">${b(us, 'US')}${b(uk, 'UK')}</div>` : '';
}
