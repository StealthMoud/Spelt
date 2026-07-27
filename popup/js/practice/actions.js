import { getFallbackExample, computeErrorWeight, calcSM2, getSpellingVariant, areSpellingVariants } from '../../../shared/storage.js';
import { getDueCards, getOnDeckUpdated, trackReview, getCardShownAt, setLastSpellingResult } from './state.js';
import { isAnswerCorrect } from './answer.js';
import { renderAudioButtons } from './helpers.js';
import { isGeminiConfigured, generateMisspellingFeedbackStream } from './ai_helpers.js';
import { escapeHtml } from '../../../shared/dom.js';

// ── Shared helpers ──────────────────────────────────────────────────

export function populateBackFace(card) {
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition || '';
  
  const posDisplay = document.getElementById('back-part-of-speech-display');
  if (posDisplay) {
    posDisplay.textContent = card.partOfSpeech || 'unknown';
  }

  const backTranslationRow = document.getElementById('back-translation-row');
  const backTranslationDisplay = document.getElementById('back-translation-display');
  if (backTranslationRow && backTranslationDisplay) {
    if (card.translation) {
      backTranslationDisplay.textContent = card.translation;
      backTranslationRow.classList.remove('hidden');
    } else {
      backTranslationRow.classList.add('hidden');
    }
  }

  const backLevelRow = document.getElementById('back-level-row');
  const backLevelDisplay = document.getElementById('back-level-display');
  if (backLevelRow && backLevelDisplay) {
    const activeLevel = card.level || document.getElementById('practice-level')?.textContent;
    if (activeLevel) {
      backLevelDisplay.textContent = activeLevel;
      backLevelRow.classList.remove('hidden');
    } else {
      backLevelRow.classList.add('hidden');
    }
  }

  // Populate US/UK spelling variant row
  const variantRow = document.getElementById('back-spelling-variants-row');
  if (variantRow) {
    const variant = card.usSpelling && card.ukSpelling
      ? { us: card.usSpelling, uk: card.ukSpelling }
      : getSpellingVariant(card.word);
    if (variant && variant.us !== variant.uk) {
      variantRow.innerHTML = `<span class="variant-tag">US:</span> <span class="variant-word">${escapeHtml(variant.us)}</span> <span class="variant-sep">·</span> <span class="variant-tag">UK:</span> <span class="variant-word">${escapeHtml(variant.uk)}</span>`;
      variantRow.classList.remove('hidden');
    } else {
      variantRow.classList.add('hidden');
    }
  }

  const backExampleContainer = document.getElementById('back-example-container');
  const backTransContainer = document.getElementById('back-example-translation-container');
  const backTransDisplay = document.getElementById('back-example-translation-display');
  const backTranslateBtn = document.getElementById('back-translate-btn');
  const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
  if (rawExample) {
    document.getElementById('back-example-display').textContent = rawExample;
    backExampleContainer.classList.remove('hidden');
  } else {
    backExampleContainer.classList.add('hidden');
  }
  const isTranslationActive = backTranslateBtn && backTranslateBtn.classList.contains('active');
  if (isTranslationActive && card.exampleTranslation) {
    if (backTransDisplay) backTransDisplay.textContent = `"${card.exampleTranslation}"`;
    if (backTransContainer) backTransContainer.classList.remove('hidden');
  } else {
    if (backTransContainer) backTransContainer.classList.add('hidden');
    if (backTransDisplay) backTransDisplay.textContent = '';
    if (backTranslateBtn) backTranslateBtn.classList.remove('active');
  }

  const audioContainer = document.getElementById('back-audio-container');
  if (audioContainer) {
    audioContainer.innerHTML = renderAudioButtons(card.word);
  }
}

function updateSrsHints(hardInt, goodInt, easyInt, recommendSelector) {
  const hardHint = document.querySelector('#practice-tab .srs-hard .srs-hint');
  const goodHint = document.querySelector('#practice-tab .srs-good .srs-hint');
  const easyHint = document.querySelector('#practice-tab .srs-easy .srs-hint');

  if (hardHint) hardHint.textContent = `${hardInt}d`;
  if (goodHint) goodHint.textContent = `${goodInt}d`;
  if (easyHint) easyHint.textContent = `${easyInt}d`;

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => btn.classList.remove('srs-recommend'));
  document.querySelector(recommendSelector)?.classList.add('srs-recommend');
}

function flipCard() {
  document.getElementById('popup-deck-card').classList.add('flipped');
  setTimeout(() => { document.querySelector('#practice-tab .srs-recommend')?.focus(); }, 200);
}

// ── Spelling Mode: check typed answer, populate back, flip ──────────

export function checkSpelling() {
  const dueCards = getDueCards();
  const card = dueCards[0];
  if (!card) return;

  const typed = document.getElementById('spelling-input').value.trim();
  const exactMatch = typed.toLowerCase() === card.word.toLowerCase();
  const isVariantMatch = !exactMatch && areSpellingVariants(typed, card.word);
  const isOk = isAnswerCorrect(typed, card.word);
  setLastSpellingResult(isOk);
  const badge = document.getElementById('spelling-result-badge');
  const typedDisplay = document.getElementById('user-typed-display');

  // Track the review for empty state summary
  const rt = getCardShownAt() > 0 ? Date.now() - getCardShownAt() : 0;
  trackReview(card.word, isOk, rt);

  // Show spelling result
  if (badge) {
    badge.classList.remove('hidden');
    if (isOk) {
      if (isVariantMatch) {
        // Determine which variant they typed
        const variant = getSpellingVariant(typed);
        const variantLabel = variant && variant.us === typed.toLowerCase() ? 'US' : 'UK';
        badge.textContent = `Correct (${variantLabel} spelling)`;
      } else {
        badge.textContent = 'Correct';
      }
      badge.className = 'result-badge success';
    } else {
      badge.textContent = 'Incorrect'; badge.className = 'result-badge danger';
    }
  }
  if (typedDisplay) {
    typedDisplay.textContent = typed || '(Blank)';
    typedDisplay.style.color = isOk ? 'var(--success)' : 'var(--danger)';
    if (typedDisplay.parentElement) typedDisplay.parentElement.classList.remove('hidden');
  }
  getOnDeckUpdated()?.();

  // Populate shared back face
  populateBackFace(card);

  // Handle AI feedback — PREFIRE: start API call immediately on wrong answer,
  // so response is ready by the time user clicks the button
  const fbRow = document.getElementById('ai-feedback-row');
  const fbText = document.getElementById('ai-feedback-text');
  if (fbRow && fbText) {
    if (!isOk) {
      isGeminiConfigured().then(configured => {
        if (configured) {
          // ── Prefire: start streaming NOW, before user clicks ──
          let prefiredText = '';
          let prefiredDone = false;
          let prefiredError = null;
          let liveCallback = null;

          generateMisspellingFeedbackStream(card, typed, (text) => {
            prefiredText = text;
            if (liveCallback) liveCallback(text);
          }).then(() => {
            prefiredDone = true;
          }).catch(err => {
            prefiredError = err;
          });

          fbRow.classList.remove('hidden');
          fbText.innerHTML = `<button type="button" class="ai-coach-trigger-btn"><span>AI Coach</span></button>`;
          fbText.querySelector('.ai-coach-trigger-btn')?.addEventListener('click', (ev) => {
            const btn = ev.currentTarget;
            btn.disabled = true;

            if (prefiredError) {
              fbText.textContent = `Could not load feedback: ${prefiredError.message}`;
              return;
            }

            if (prefiredText) {
              // Already have text — show instantly
              fbText.textContent = prefiredText;
              if (!prefiredDone) {
                liveCallback = (text) => { fbText.textContent = text; };
              }
            } else {
              // API hasn't returned anything yet — show loading + wire live updates
              btn.querySelector('span').textContent = 'Analyzing...';
              btn.style.opacity = '0.6';
              liveCallback = (text) => { fbText.textContent = text; };
            }
          });
        } else {
          fbRow.classList.add('hidden');
        }
      });
    } else {
      fbRow.classList.add('hidden');
    }
  }

  // Past misspellings
  const pastContainer = document.getElementById('past-misspellings-container');
  let displayErrors = card.misspellings ? card.misspellings.filter(Boolean) : [];
  if (!isOk && typed && !displayErrors.includes(typed) && typed.toLowerCase() !== card.word.toLowerCase()) {
    displayErrors.push(typed);
  }
  if (displayErrors.length > 0) {
    document.getElementById('back-misspellings-display').textContent = [...new Set(displayErrors)].join(', ');
    pastContainer.classList.remove('hidden');
  } else { pastContainer.classList.add('hidden'); }

  // SRS interval hints (spelling track)
  const totalErrors = card.totalErrors !== undefined ? card.totalErrors : (card.misspellings || []).length;
  const correctStreak = card.correctStreak || 0;
  const errorWeight = computeErrorWeight(totalErrors, correctStreak);
  const hardInt = calcSM2(3, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;
  const goodInt = calcSM2(4, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;
  const easyInt = calcSM2(5, card.rep, card.interval, card.ef, 1.0, isOk, errorWeight).interval;
  updateSrsHints(hardInt, goodInt, easyInt, isOk ? '#practice-tab .srs-good' : '#practice-tab .srs-again');

  flipCard();
}

// ── Recall Mode: populate back (no typed answer), flip ─────────────

export function revealRecall() {
  const dueCards = getDueCards();
  const card = dueCards[0];
  if (!card) return;

  // Hide spelling-specific UI
  const badge = document.getElementById('spelling-result-badge');
  if (badge) badge.classList.add('hidden');
  const typedDisplay = document.getElementById('user-typed-display');
  if (typedDisplay && typedDisplay.parentElement) typedDisplay.parentElement.classList.add('hidden');

  // Populate shared back face
  populateBackFace(card);

  // Hide AI Coach panel in recall mode since there are no spelling errors
  const fbRow = document.getElementById('ai-feedback-row');
  if (fbRow) fbRow.classList.add('hidden');

  // Hide past misspellings (not relevant in recall mode)
  const pastContainer = document.getElementById('past-misspellings-container');
  if (pastContainer) pastContainer.classList.add('hidden');

  // SRS interval hints (recall track)
  const hardInt = calcSM2(3, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  const goodInt = calcSM2(4, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  const easyInt = calcSM2(5, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  updateSrsHints(hardInt, goodInt, easyInt, '#practice-tab .srs-good');

  flipCard();
}



