import { getFallbackExample, computeErrorWeight, calcSM2 } from '../../../shared/storage.js';
import { getDueCards, getOnDeckUpdated, trackReview, getCardShownAt } from './state.js';
import { renderAudioButtons } from './helpers.js';
import { isGeminiConfigured, generateMisspellingFeedback, generateRecallFeedback, generateSyntaxFeedback } from './ai_helpers.js';

// ── Shared helpers ──────────────────────────────────────────────────

export function populateBackFace(card) {
  const isSyntax = card.practiceType === 'syntax';
  
  document.getElementById('back-word-display').textContent = card.word;
  document.getElementById('back-definition-display').textContent = card.definition || '';
  
  const posDisplay = document.getElementById('back-part-of-speech-display');
  if (posDisplay) {
    posDisplay.textContent = isSyntax ? 'Syntax Pattern' : (card.partOfSpeech || 'unknown');
  }

  const backTranslationRow = document.getElementById('back-translation-row');
  const backTranslationDisplay = document.getElementById('back-translation-display');
  if (backTranslationRow && backTranslationDisplay) {
    if (card.translation) {
      backTranslationDisplay.textContent = card.translation;
      backTranslationRow.style.display = 'block';
    } else {
      backTranslationRow.style.display = 'none';
    }
  }

  const backLevelRow = document.getElementById('back-level-row');
  const backLevelDisplay = document.getElementById('back-level-display');
  if (backLevelRow && backLevelDisplay) {
    const activeLevel = card.level || document.getElementById('practice-level')?.textContent;
    if (activeLevel && !isSyntax) {
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
  const rawExample = isSyntax ? card.example : (card.example || getFallbackExample(card.word, card.partOfSpeech));
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
  if (audioContainer) {
    audioContainer.innerHTML = isSyntax ? '' : renderAudioButtons(card.word);
  }

  // Handle writing example row for syntax mode
  const writingRow = document.getElementById('back-syntax-writing-row');
  const writingDisplay = document.getElementById('back-syntax-writing-display');
  if (writingRow && writingDisplay) {
    if (isSyntax && card.writingExample) {
      writingDisplay.textContent = card.writingExample;
      writingRow.style.display = 'block';
    } else {
      writingRow.style.display = 'none';
    }
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
  const isOk = typed.toLowerCase() === card.word.toLowerCase();
  const badge = document.getElementById('spelling-result-badge');
  const typedDisplay = document.getElementById('user-typed-display');

  // Track the review for empty state summary
  const rt = getCardShownAt() > 0 ? Date.now() - getCardShownAt() : 0;
  trackReview(card.word, isOk, rt);

  // Show spelling result
  if (badge) {
    badge.style.display = 'inline-flex';
    if (isOk) {
      badge.textContent = 'Correct'; badge.className = 'result-badge success';
    } else {
      badge.textContent = 'Incorrect'; badge.className = 'result-badge danger';
    }
  }
  if (typedDisplay) {
    typedDisplay.textContent = typed || '(Blank)';
    typedDisplay.style.color = isOk ? 'var(--success)' : 'var(--danger)';
    if (typedDisplay.parentElement) typedDisplay.parentElement.style.display = 'block';
  }
  getOnDeckUpdated()?.();

  // Populate shared back face
  populateBackFace(card);

  // Handle AI feedback — button-gated to prevent rate limits
  const fbRow = document.getElementById('ai-feedback-row');
  const fbText = document.getElementById('ai-feedback-text');
  if (fbRow && fbText) {
    if (!isOk) {
      isGeminiConfigured().then(configured => {
        if (configured) {
          fbRow.style.display = 'block';
          fbText.innerHTML = `<button type="button" class="ai-coach-trigger-btn" style="background: hsla(260, 60%, 50%, 0.15); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; padding: 4px 10px; font-size: 0.68rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">✨ <span>AI Coach</span></button>`;
          fbText.querySelector('.ai-coach-trigger-btn')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget;
            btn.disabled = true;
            btn.querySelector('span').textContent = 'Analyzing...';
            btn.style.opacity = '0.6';
            try {
              const feedback = await generateMisspellingFeedback(card, typed);
              fbText.textContent = feedback;
            } catch (err) {
              fbText.textContent = `Could not load feedback: ${err.message}`;
            }
          });
        } else {
          fbRow.style.display = 'none';
        }
      });
    } else {
      fbRow.style.display = 'none';
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
    pastContainer.style.display = 'block';
  } else { pastContainer.style.display = 'none'; }

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
  if (badge) badge.style.display = 'none';
  const typedDisplay = document.getElementById('user-typed-display');
  if (typedDisplay && typedDisplay.parentElement) typedDisplay.parentElement.style.display = 'none';

  // Populate shared back face
  populateBackFace(card);

  // Handle AI feedback — button-gated to prevent rate limits
  const fbRow = document.getElementById('ai-feedback-row');
  const fbText = document.getElementById('ai-feedback-text');
  if (fbRow && fbText) {
    isGeminiConfigured().then(configured => {
      if (configured) {
        fbRow.style.display = 'block';
        fbText.innerHTML = `<button type="button" class="ai-coach-trigger-btn" style="background: hsla(260, 60%, 50%, 0.15); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; padding: 4px 10px; font-size: 0.68rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">✨ <span>AI Coach</span></button>`;
        fbText.querySelector('.ai-coach-trigger-btn')?.addEventListener('click', async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          btn.querySelector('span').textContent = 'Checking...';
          btn.style.opacity = '0.6';
          try {
            const feedback = await generateRecallFeedback(card);
            fbText.textContent = feedback;
          } catch (err) {
            fbText.textContent = `Mnemonic help: ${err.message}`;
          }
        });
      } else {
        fbRow.style.display = 'none';
      }
    });
  }

  // Hide past misspellings (not relevant in recall mode)
  const pastContainer = document.getElementById('past-misspellings-container');
  if (pastContainer) pastContainer.style.display = 'none';

  // SRS interval hints (recall track)
  const hardInt = calcSM2(3, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  const goodInt = calcSM2(4, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  const easyInt = calcSM2(5, card.meaningRep || 0, card.meaningInterval || 0, card.meaningEf || 2.5, 1.0, true, 1.0).interval;
  updateSrsHints(hardInt, goodInt, easyInt, '#practice-tab .srs-good');

  flipCard();
}

// ── Syntax Mode: check joints answer, populate back, flip ─────────────

export function checkSyntax() {
  const dueCards = getDueCards();
  const card = dueCards[0];
  if (!card) return;

  const typed = document.getElementById('syntax-joints-input').value.trim();
  const typedParts = typed.split(',').map(s => s.trim().toLowerCase());
  const correctParts = (card.joints || []).map(s => s.trim().toLowerCase());
  
  const isOk = typedParts.length === correctParts.length && typedParts.every((val, idx) => val === correctParts[idx]);
  
  // Track review
  const rt = getCardShownAt() > 0 ? Date.now() - getCardShownAt() : 0;
  trackReview(card.word, isOk, rt);

  const badge = document.getElementById('spelling-result-badge');
  const typedDisplay = document.getElementById('user-typed-display');

  // Show spelling result badge
  if (badge) {
    badge.style.display = 'inline-flex';
    if (isOk) {
      badge.textContent = 'Correct'; badge.className = 'result-badge success';
    } else {
      badge.textContent = 'Incorrect'; badge.className = 'result-badge danger';
    }
  }
  if (typedDisplay) {
    typedDisplay.textContent = typed || '(Blank)';
    typedDisplay.style.color = isOk ? 'var(--success)' : 'var(--danger)';
    if (typedDisplay.parentElement) typedDisplay.parentElement.style.display = 'block';
  }
  getOnDeckUpdated()?.();

  // Populate back face
  populateBackFace(card);

  // Handle AI feedback for syntax — button-gated to prevent rate limits
  const fbRow = document.getElementById('ai-feedback-row');
  const fbText = document.getElementById('ai-feedback-text');
  if (fbRow && fbText) {
    if (!isOk) {
      isGeminiConfigured().then(configured => {
        if (configured) {
          fbRow.style.display = 'block';
          fbText.innerHTML = `<button type="button" class="ai-coach-trigger-btn" style="background: hsla(260, 60%, 50%, 0.15); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; padding: 4px 10px; font-size: 0.68rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease;">✨ <span>AI Coach</span></button>`;
          fbText.querySelector('.ai-coach-trigger-btn')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget;
            btn.disabled = true;
            btn.querySelector('span').textContent = 'Analyzing...';
            btn.style.opacity = '0.6';
            try {
              const feedback = await generateSyntaxFeedback(card, typed);
              fbText.textContent = feedback;
            } catch (err) {
              fbText.textContent = `Could not load feedback: ${err.message}`;
            }
          });
        } else {
          fbRow.style.display = 'none';
        }
      });
    } else {
      fbRow.style.display = 'none';
    }
  }

  // Hide past misspellings (not relevant in syntax mode)
  const pastContainer = document.getElementById('past-misspellings-container');
  if (pastContainer) pastContainer.style.display = 'none';

  // SRS interval hints (syntax track uses default rep/interval/ef but starting with EF 2.0)
  const hardInt = calcSM2(3, card.rep || 0, card.interval || 0, card.ef || 2.0, 1.0, isOk, 1.0).interval;
  const goodInt = calcSM2(4, card.rep || 0, card.interval || 0, card.ef || 2.0, 1.0, isOk, 1.0).interval;
  const easyInt = calcSM2(5, card.rep || 0, card.interval || 0, card.ef || 2.0, 1.0, isOk, 1.0).interval;
  updateSrsHints(hardInt, goodInt, easyInt, isOk ? '#practice-tab .srs-good' : '#practice-tab .srs-again');

  flipCard();
}

