import { getWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation, isGeminiConfigured, atomicUpdate } from '../../../shared/storage.js';
import { selectDueCards, isDueInMode } from '../../../src/core/selectors.js';
import { escapeHtml } from '../../../shared/dom.js';
import { peekCard, getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, hasReviewedWord, refreshReviewedWordDay, getPracticeMode, getSessionStats, resetSessionStats } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';
import { generateHint, generateSessionSummary, verifyPracticeWriting } from './ai_helpers.js';
import { populateBackFace } from './actions.js';

let writingFeedbackTimeoutId = null;



export async function loadPracticeDeck() {
  refreshReviewedWordDay();
  const words = await getWords();
  const mode = getPracticeMode();
  const reviewedSet = new Set(words.filter(w => hasReviewedWord(w.id, mode)).map(w => w.id));
  setDueCards(selectDueCards(words, mode, { excludeIds: reviewedSet }));
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) {
    cardEl.classList.add('hidden'); emptyEl.classList.remove('hidden');
    // Trigger AI session summary
    triggerSessionSummary();
    return;
  }

  cardEl.classList.remove('hidden'); emptyEl.classList.add('hidden');
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  // Reset AI hint and feedback bubbles
  const hintBubble = document.getElementById('ai-hint-bubble');
  if (hintBubble) hintBubble.classList.add('hidden');
  const backHintBubble = document.getElementById('back-ai-hint-bubble');
  if (backHintBubble) {
    backHintBubble.classList.add('hidden');
    backHintBubble.style.top = 'auto';
    backHintBubble.style.right = '14px';
    backHintBubble.style.bottom = '74px';
    backHintBubble.style.left = '14px';
  }
  const fbBubble = document.getElementById('ai-feedback-row');
  if (fbBubble) {
    fbBubble.classList.add('hidden');
    fbBubble.style.top = 'auto';
    fbBubble.style.right = '14px';
    fbBubble.style.bottom = '74px';
    fbBubble.style.left = '14px';
  }

  const card = dueCards[0];

  // Show AI components if configured
  setupAIHintButton(card);
  setupBackAIHintButton(card);
  setupAIWritingPractice(card);
  setupAISpellingFeedback();
  
  populateFrontFace(card);
}

export function populateFrontFace(card) {
  const mode = getPracticeMode();

  const frontSpellingContent = document.getElementById('front-spelling-content');
  const frontRecallContent = document.getElementById('front-recall-content');
  
  const frontSpellingWrapper = document.getElementById('front-spelling-wrapper');
  const frontRecallWrapper = document.getElementById('front-recall-wrapper');

  if (mode === 'recall') {
    if (frontSpellingContent) frontSpellingContent.classList.add('hidden');
    if (frontRecallContent) frontRecallContent.classList.remove('hidden');
    if (frontSpellingWrapper) frontSpellingWrapper.classList.add('hidden');
    if (frontRecallWrapper) frontRecallWrapper.classList.remove('hidden');

    document.getElementById('recall-front-word').textContent = card.word;
    document.getElementById('recall-front-transcription').textContent = card.transcription || '/--/';
    const recallAudio = document.getElementById('recall-front-audio-container');
    if (recallAudio) recallAudio.innerHTML = renderAudioButtons(card.word);
    document.getElementById('recall-front-pos').textContent = card.partOfSpeech || 'unknown';

    const levelContainer = document.getElementById('recall-front-level-container');
    const levelEl = document.getElementById('recall-front-level');
    if (levelContainer && levelEl) {
      let displayLevel = card.level || '';
      levelEl.textContent = displayLevel;
      levelContainer.classList.toggle('hidden', !displayLevel);
    }

    // Populate and show example sentence on front for Recall mode context clues
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    const exampleContainer = document.getElementById('recall-front-example-container');
    if (rawExample) {
      document.getElementById('recall-front-example').textContent = rawExample;
      if (exampleContainer) exampleContainer.classList.remove('hidden');
    } else {
      if (exampleContainer) exampleContainer.classList.add('hidden');
    }

    // Set dynamic hint/prompt text
    const hintEl = document.getElementById('recall-front-hint');
    if (hintEl) {
      hintEl.textContent = card.word.trim().includes(' ') 
        ? 'What does this expression mean?' 
        : 'What does this word mean?';
    }
  } else {
    if (frontSpellingContent) frontSpellingContent.classList.remove('hidden');
    if (frontRecallContent) frontRecallContent.classList.add('hidden');
    if (frontSpellingWrapper) frontSpellingWrapper.classList.remove('hidden');
    if (frontRecallWrapper) frontRecallWrapper.classList.add('hidden');

    document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
    document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
    document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

    const transEl = document.getElementById('practice-translation');
    if (transEl) {
      if (card.translation) {
        transEl.innerHTML = `<span class="translation-blur-text">${escapeHtml(card.translation)}</span><span class="translation-reveal-hint">Reveal</span>`;
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
      levelContainer.classList.toggle('hidden', !displayLevel);
    }

    const exampleContainer = document.getElementById('practice-example-container');
    const exampleTransEl = document.getElementById('practice-example-translation');
    const translateBtn = document.getElementById('practice-translate-btn');
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (rawExample) {
      document.getElementById('practice-example').textContent = censorWordInExample(card.word, rawExample);
      exampleContainer.classList.remove('hidden');
    } else exampleContainer.classList.add('hidden');
    const isTransActive = translateBtn && translateBtn.classList.contains('active');
    if (isTransActive && card.exampleTranslation) {
      if (exampleTransEl) {
        exampleTransEl.textContent = `"${card.exampleTranslation}"`;
        exampleTransEl.classList.remove('hidden');
      }
    } else {
      if (exampleTransEl) { exampleTransEl.classList.add('hidden'); exampleTransEl.textContent = ''; }
      if (translateBtn) translateBtn.classList.remove('active');
    }

    const audioContainer = document.getElementById('practice-audio-container');
    if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  // Handle Cambridge pronunciation auto-fetch if level doesn't exist
  if (card.word && !card.level) {
    fetchCambridgePronunciation(card.word).then(async cambridge => {
      if (cambridge.level) {
        card.level = cambridge.level;
        card.otherLevels = (cambridge.allLevels || []).filter(l => l !== cambridge.level);
        
        // Dynamically update UI in place
        if (mode === 'recall') {
          const levelEl = document.getElementById('recall-front-level');
          const levelContainer = document.getElementById('recall-front-level-container');
          if (levelEl && levelContainer) {
            levelEl.textContent = card.level;
            levelContainer.classList.remove('hidden');
          }
        } else {
          const levelEl = document.getElementById('practice-level');
          const levelContainer = document.getElementById('practice-level-container');
          if (levelEl && levelContainer) {
            levelEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
            levelContainer.classList.remove('hidden');
          }
        }
        
        await atomicUpdate(async (list) => {
          const w = list.find(x => x.id === card.id);
          if (w) { w.level = card.level; w.otherLevels = card.otherLevels; }
        });
      }
    }).catch(() => {});
  }
}

export async function syncPracticeDeck() {
  refreshReviewedWordDay();
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
    return isDueInMode(f, mode, now) && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  due.push(...fresh.filter(w => {
    return isDueInMode(w, mode, now) && !ids.has(w.id) && !hasReviewedWord(w.id, mode);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id;
  if (oldActiveId !== newActiveId) {
    showPracticeCard();
  } else if (newActiveId) {
    // Refresh front and back faces in-place without resetting flipped state/inputs
    const freshCard = fresh.find(w => w.id === newActiveId);
    if (freshCard) {
      populateFrontFace(freshCard);
      populateBackFace(freshCard);
    }
  }
}

async function mountHintPanel({ btnId, bubbleId, textId, regenId, closeId, defaultBottom }, card) {
  const hintBtn = document.getElementById(btnId);
  const hintBubble = document.getElementById(bubbleId);
  const hintText = document.getElementById(textId);
  const regenBtn = document.getElementById(regenId);
  const closeBtn = document.getElementById(closeId);
  if (!hintBtn || !hintBubble || !hintText) return;

  hintBubble.style.top = 'auto';
  hintBubble.style.right = '14px';
  hintBubble.style.bottom = defaultBottom;
  hintBubble.style.left = '14px';

  makeElementDraggable(hintBubble);

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    hintBtn.classList.add('hidden');
    return;
  }

  hintBtn.classList.remove('hidden');
  hintBubble.classList.add('hidden');
  hintText.textContent = '';

  const handleHintRequest = async (forceRegen = false) => {
    const currentCard = card || peekCard();
    if (!currentCard) return;
    hintText.textContent = forceRegen ? 'Regenerating...' : 'Asking AI Coach...';
    hintBubble.classList.remove('hidden');
    try {
      if (forceRegen) {
        currentCard.aiHint = null;
        try {
          await atomicUpdate(async (words) => {
            const w = words.find(x => x.id === currentCard.id);
            if (w) delete w.aiHint;
          });
        } catch {}
      }
      const hint = await generateHint(currentCard);
      hintText.innerHTML = hint.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" style="margin-bottom: 4px;">${escapeHtml(l)}</div>`).join('');
    } catch (err) {
      hintText.textContent = `Could not generate hint: ${err.message}`;
    }
  };

  const newHintBtn = hintBtn.cloneNode(true);
  hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
  newHintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hintBubble.classList.contains('hidden')) {
      hintBubble.classList.add('hidden');
    } else {
      handleHintRequest(false);
    }
  });

  if (regenBtn) {
    const newRegenBtn = regenBtn.cloneNode(true);
    regenBtn.parentNode.replaceChild(newRegenBtn, regenBtn);
    newRegenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHintRequest(true);
    });
  }

  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hintBubble.classList.add('hidden');
    });
  }
}

function setupAIHintButton(card) {
  return mountHintPanel({
    btnId: 'ai-hint-btn',
    bubbleId: 'ai-hint-bubble',
    textId: 'ai-hint-text',
    regenId: 'ai-hint-regen',
    closeId: 'ai-hint-close',
    defaultBottom: '62px'
  }, card);
}

function setupBackAIHintButton(card) {
  return mountHintPanel({
    btnId: 'back-ai-hint-btn',
    bubbleId: 'back-ai-hint-bubble',
    textId: 'back-ai-hint-text',
    regenId: 'back-ai-hint-regen',
    closeId: 'back-ai-hint-close',
    defaultBottom: '74px'
  }, card);
}

async function triggerSessionSummary() {
  const container = document.getElementById('ai-session-summary');
  const textEl = document.getElementById('ai-session-summary-text');
  if (!container || !textEl) return;

  container.classList.add('hidden');
  textEl.textContent = '';

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) return;

  const stats = getSessionStats();
  if (stats.totalReviewed === 0) return;

  // Show button-gated AI summary — no auto-fire to prevent rate limits
  container.classList.remove('hidden');
  textEl.innerHTML = `<button type="button" id="ai-session-summary-btn" style="background: hsla(260, 60%, 50%, 0.15); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; padding: 5px 12px; font-size: 0.68rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease; margin: 4px auto;"><span>Generate AI Summary</span></button>`;
  textEl.querySelector('#ai-session-summary-btn')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Generating...';
    btn.style.opacity = '0.6';
    try {
      const mode = getPracticeMode();
      const summary = await generateSessionSummary({
        ...stats,
        mode: mode.toUpperCase()
      });
      textEl.textContent = summary;
      resetSessionStats();
    } catch (err) {
      textEl.textContent = `Could not load summary: ${err.message}`;
    }
  });
}



async function setupAIWritingPractice(card) {
  const practicePanel = document.getElementById('ai-writing-practice-panel');
  const titleText = document.getElementById('ai-writing-practice-title-text');
  const inputEl = document.getElementById('ai-practice-writing-input');
  const verifyBtn = document.getElementById('ai-practice-writing-btn');
  const feedbackEl = document.getElementById('ai-practice-writing-feedback');
  const feedbackContentEl = document.getElementById('ai-practice-writing-feedback-content');
  const feedbackCloseBtn = document.getElementById('ai-practice-writing-feedback-close');
  const headerEl = document.getElementById('ai-writing-practice-header');
  const bodyEl = document.getElementById('ai-writing-practice-body');

  if (!practicePanel || !inputEl || !verifyBtn || !feedbackEl || !headerEl || !bodyEl) return;

  // Reset dragged position back to defaults on load
  feedbackEl.style.top = 'auto';
  feedbackEl.style.right = '14px';
  feedbackEl.style.bottom = '74px';
  feedbackEl.style.left = '14px';

  // Make writing practice feedback overlay draggable
  makeElementDraggable(feedbackEl);

  // Clear inputs and state
  inputEl.value = '';
  feedbackEl.classList.add('hidden');
  bodyEl.classList.add('hidden'); // Collapsed by default!
  if (feedbackContentEl) feedbackContentEl.innerHTML = '';
  if (writingFeedbackTimeoutId) {
    clearTimeout(writingFeedbackTimeoutId);
    writingFeedbackTimeoutId = null;
  }

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    practicePanel.classList.add('hidden');
    return;
  }

  practicePanel.classList.remove('hidden');
  const mode = getPracticeMode();

  if (titleText) titleText.textContent = 'Active Vocabulary Practice';
  inputEl.setAttribute('placeholder', `Write a sentence using the word "${card.word}"...`);

  // Set up collapsible toggle
  const newHeaderEl = headerEl.cloneNode(true);
  headerEl.parentNode.replaceChild(newHeaderEl, headerEl);
  
  const toggleText = document.getElementById('ai-writing-practice-toggle-text');
  const toggleIcon = document.getElementById('ai-writing-practice-toggle-icon');
  
  if (toggleText) toggleText.textContent = 'Start Practice';
  if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';

  newHeaderEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const freshToggleText = document.getElementById('ai-writing-practice-toggle-text');
    const freshToggleIcon = document.getElementById('ai-writing-practice-toggle-icon');
    
    if (bodyEl.classList.contains('hidden')) {
      bodyEl.classList.remove('hidden');
      if (freshToggleText) freshToggleText.textContent = 'Collapse';
      if (freshToggleIcon) freshToggleIcon.style.transform = 'rotate(180deg)';
      inputEl.focus();
    } else {
      bodyEl.classList.add('hidden');
      if (freshToggleText) freshToggleText.textContent = 'Start Practice';
      if (freshToggleIcon) freshToggleIcon.style.transform = 'rotate(0deg)';
    }
  });

  const showFeedback = (content, autoHideDuration) => {
    if (writingFeedbackTimeoutId) {
      clearTimeout(writingFeedbackTimeoutId);
      writingFeedbackTimeoutId = null;
    }
    const targetEl = feedbackContentEl || feedbackEl;
    targetEl.replaceChildren();

    if (typeof content === 'string') {
      const span = document.createElement('span');
      span.style.fontSize = '0.65rem';
      span.textContent = content;
      targetEl.appendChild(span);
    } else if (content && typeof content === 'object') {
      const isOk = content.verdict === 'correct';
      const badge = document.createElement('span');
      badge.style.color = isOk ? 'var(--success)' : 'var(--danger)';
      badge.style.fontWeight = '700';
      badge.textContent = isOk ? '✓ Correct Usage' : '✗ Incorrect';
      targetEl.appendChild(badge);

      if (content.correction) {
        const corrDiv = document.createElement('div');
        corrDiv.style.marginTop = '4px';
        const strong = document.createElement('strong');
        strong.textContent = 'Correction: ';
        corrDiv.appendChild(strong);
        corrDiv.appendChild(document.createTextNode(content.correction));
        targetEl.appendChild(corrDiv);
      }

      if (content.feedback) {
        const fbDiv = document.createElement('div');
        fbDiv.style.marginTop = '4px';
        const strong = document.createElement('strong');
        strong.textContent = 'Coach Feedback: ';
        fbDiv.appendChild(strong);
        fbDiv.appendChild(document.createTextNode(content.feedback));
        targetEl.appendChild(fbDiv);
      }
    }

    feedbackEl.classList.remove('hidden');

    if (autoHideDuration) {
      writingFeedbackTimeoutId = setTimeout(() => {
        feedbackEl.classList.add('hidden');
        writingFeedbackTimeoutId = null;
      }, autoHideDuration);
    }
  };

  const handleVerifyRequest = async () => {
    const userText = inputEl.value.trim();
    if (!userText) {
      showFeedback('Please write a sentence first.', 0);
      return;
    }

    showFeedback('AI Coach is grading your sentence...', 0);
    verifyBtn.setAttribute('disabled', 'true');

    try {
      const feedback = await verifyPracticeWriting(card, userText, mode);
      showFeedback(feedback, 0); // No timer: user closes it manually
    } catch (err) {
      showFeedback(`Could not verify sentence: ${err.message}`, 0);
    } finally {
      verifyBtn.removeAttribute('disabled');
    }
  };

  const newVerifyBtn = verifyBtn.cloneNode(true);
  verifyBtn.parentNode.replaceChild(newVerifyBtn, verifyBtn);
  newVerifyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleVerifyRequest();
  });

  if (feedbackCloseBtn) {
    const newCloseBtn = feedbackCloseBtn.cloneNode(true);
    feedbackCloseBtn.parentNode.replaceChild(newCloseBtn, feedbackCloseBtn);
    newCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      feedbackEl.classList.add('hidden');
      if (writingFeedbackTimeoutId) {
        clearTimeout(writingFeedbackTimeoutId);
        writingFeedbackTimeoutId = null;
      }
    });
  }
}

function setupAISpellingFeedback() {
  const fbRow = document.getElementById('ai-feedback-row');
  const closeBtn = document.getElementById('ai-feedback-close');
  if (!fbRow) return;

  // Make spelling check result feedback draggable
  makeElementDraggable(fbRow);

  // Wire up close button manually
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fbRow.classList.add('hidden');
    });
  }
}

/**
 * Make an absolute positioned element draggable within the card face limits
 * Caches parent/element rects on drag start.
 */
function makeElementDraggable(el) {
  let startX = 0, startY = 0;
  let currentLeft = 0, currentTop = 0;
  
  // Cached dimensions to avoid layout thrashing in mousemove loop
  let parentWidth = 0, parentHeight = 0;
  let rectWidth = 0, rectHeight = 0;

  el.addEventListener('mousedown', dragMouseDown);
  el.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    // Prevent dragging when targeting selectable AI text
    if (e.target.closest('#ai-feedback-text') || 
        e.target.closest('#ai-hint-text') || 
        e.target.closest('#back-ai-hint-text') || 
        e.target.closest('#ai-practice-writing-feedback-content')) {
      return;
    }
    e.preventDefault();
    
    startX = e.clientX;
    startY = e.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
    // Cache dimensions once on start of drag
    const parentRect = el.parentElement.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    parentWidth = parentRect.width;
    parentHeight = parentRect.height;
    rectWidth = rect.width;
    rectHeight = rect.height;
    
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e.preventDefault();
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    updatePosition(currentLeft + deltaX, currentTop + deltaY);
  }

  function dragTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    // Prevent dragging when targeting selectable AI text
    if (e.target.closest('#ai-feedback-text') || 
        e.target.closest('#ai-hint-text') || 
        e.target.closest('#back-ai-hint-text') || 
        e.target.closest('#ai-practice-writing-feedback-content')) {
      return;
    }
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
    // Cache dimensions once on start of touch drag
    const parentRect = el.parentElement.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    parentWidth = parentRect.width;
    parentHeight = parentRect.height;
    rectWidth = rect.width;
    rectHeight = rect.height;
    
    document.addEventListener('touchend', closeDragElement);
    document.addEventListener('touchmove', elementTouchMove, { passive: false });
  }

  function elementTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    updatePosition(currentLeft + deltaX, currentTop + deltaY);
  }

  function updatePosition(newLeft, newTop) {
    const margin = 8;
    
    if (newLeft < margin) newLeft = margin;
    if (newLeft + rectWidth > parentWidth - margin) {
      newLeft = parentWidth - rectWidth - margin;
    }
    if (newTop < margin) newTop = margin;
    if (newTop + rectHeight > parentHeight - margin) {
      newTop = parentHeight - rectHeight - margin;
    }

    el.style.bottom = 'auto';
    el.style.right = 'auto';
    el.style.left = `${newLeft}px`;
    el.style.top = `${newTop}px`;
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('touchend', closeDragElement);
    document.removeEventListener('touchmove', elementTouchMove);
  }
}
