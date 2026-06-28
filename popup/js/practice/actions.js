import { getFallbackExample, computeErrorWeight, calcSM2 } from '../../../shared/storage.js';
import { getDueCards, getOnDeckUpdated } from './state.js';
import { renderAudioButtons } from './helpers.js';

export function checkSpelling() {
  const dueCards = getDueCards();
  const card = dueCards[0];
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
  getOnDeckUpdated()?.();

  typedDisplay.textContent = typed || '(Blank)';
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition;
  document.getElementById('back-transcription-display').textContent = card.transcription || '/--/';
  document.getElementById('back-part-of-speech-display').textContent = card.partOfSpeech || 'unknown';

  const backLevelRow = document.getElementById('back-level-row');
  const backLevelDisplay = document.getElementById('back-level-display');
  if (backLevelRow && backLevelDisplay) {
    const activeLevel = card.level || document.getElementById('practice-level')?.textContent;
    if (activeLevel) {
      backLevelDisplay.textContent = activeLevel;
      backLevelRow.style.display = 'block';
    } else {
      backLevelRow.style.display = 'none';
    }
  }

  const backExampleContainer = document.getElementById('back-example-container');
  const backTransContainer = document.getElementById('back-example-translation-container');
  const backTransDisplay = document.getElementById('back-example-translation-display');
  const backTranslateBtn = document.getElementById('back-translate-btn');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    document.getElementById('back-example-display').textContent = rawExample;
    backExampleContainer.style.display = 'block';
  } else {
    backExampleContainer.style.display = 'none';
  }
  if (backTransContainer) backTransContainer.style.display = 'none';
  if (backTransDisplay) backTransDisplay.textContent = '';
  if (backTranslateBtn) backTranslateBtn.classList.remove('active');

  const audioContainer = document.getElementById('back-audio-container');
  if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);

  const pastContainer = document.getElementById('past-misspellings-container');
  let displayErrors = card.misspellings ? card.misspellings.filter(Boolean) : [];
  if (!isOk && typed && !displayErrors.includes(typed) && typed.toLowerCase() !== card.word.toLowerCase()) {
    displayErrors.push(typed);
  }
  if (displayErrors.length > 0) {
    document.getElementById('back-misspellings-display').textContent = [...new Set(displayErrors)].join(', ');
    pastContainer.style.display = 'block';
  } else { pastContainer.style.display = 'none'; }

  const totalErrors = card.totalErrors !== undefined ? card.totalErrors : (card.misspellings || []).length;
  const correctStreak = card.correctStreak || 0;
  const errorWeight = computeErrorWeight(totalErrors, correctStreak);
  const hardInterval = calcSM2(3, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;
  const goodInterval = calcSM2(4, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;
  const easyInterval = calcSM2(5, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;

  const hardHint = document.querySelector('#practice-tab .srs-hard .srs-hint');
  const goodHint = document.querySelector('#practice-tab .srs-good .srs-hint');
  const easyHint = document.querySelector('#practice-tab .srs-easy .srs-hint');

  if (hardHint) hardHint.textContent = `${hardInterval}d`;
  if (goodHint) goodHint.textContent = `${goodInterval}d`;
  if (easyHint) easyHint.textContent = `${easyInterval}d`;

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => btn.classList.remove('srs-recommend'));
  document.querySelector(isOk ? '#practice-tab .srs-good' : '#practice-tab .srs-again').classList.add('srs-recommend');

  document.getElementById('popup-deck-card').classList.add('flipped');
  setTimeout(() => { document.querySelector('#practice-tab .srs-recommend')?.focus(); }, 200);
}
