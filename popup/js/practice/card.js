import { getWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation, isGeminiConfigured, atomicUpdate } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, getIsSubmitting, hasReviewedWord, refreshReviewedWordDay, getPracticeMode, getSessionStats, resetSessionStats } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';
import { generateHint, generateSessionSummary, generateSyntaxExplanation, generateSyntaxPuzzleHint, verifyPracticeWriting } from './ai_helpers.js';
import { populateBackFace } from './actions.js';

let currentSyntaxCard = null;
let scrambledPool = [];
let orderedBlocks = [];
let writingFeedbackTimeoutId = null;
let aiHintTimeoutId = null;

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderBlocksUI() {
  if (!currentSyntaxCard) return;
  const scrambledContainer = document.getElementById('syntax-blocks-scrambled');
  const orderedContainer = document.getElementById('syntax-blocks-ordered');
  
  if (!scrambledContainer || !orderedContainer) return;
  scrambledContainer.innerHTML = '';
  orderedContainer.innerHTML = '';

  scrambledPool.forEach((blockText, idx) => {
    const btn = document.createElement('button');
    btn.className = 'practice-mode-pill';
    btn.style.cssText = 'padding: 6px 12px; font-size: 0.7rem; background: hsla(0, 0%, 100%, 0.03); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); cursor: pointer; text-align: left; transition: all 0.15s ease; font-weight: 500; outline: none;';
    btn.textContent = blockText;
    
    // Premium hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'hsla(260, 60%, 50%, 0.12)';
      btn.style.borderColor = 'hsla(260, 60%, 50%, 0.3)';
      btn.style.color = '#c4b5fd';
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'hsla(0, 0%, 100%, 0.03)';
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-muted)';
      btn.style.transform = 'none';
    });
    
    btn.addEventListener('click', () => {
      scrambledPool.splice(idx, 1);
      orderedBlocks.push(blockText);
      renderBlocksUI();
    });
    scrambledContainer.appendChild(btn);
  });

  orderedBlocks.forEach((blockText, idx) => {
    const el = document.createElement('div');
    el.style.cssText = 'padding: 6px 10px; font-size: 0.72rem; background: rgba(167, 139, 250, 0.06); border: 1px solid rgba(167, 139, 250, 0.2); border-radius: var(--radius-sm); color: #c4b5fd; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 500; transition: all 0.15s ease;';
    el.innerHTML = `<span style="word-break: break-word; flex: 1;">${blockText}</span><span class="remove-x" style="font-size: 0.65rem; color: rgba(167, 139, 250, 0.6); margin-left: 6px; flex-shrink: 0; transition: color 0.15s ease;">✕</span>`;
    
    // Destructive/Remove hover effect
    el.addEventListener('mouseenter', () => {
      el.style.background = 'rgba(239, 68, 68, 0.06)';
      el.style.borderColor = 'rgba(239, 68, 68, 0.25)';
      el.style.color = '#fca5a5';
      const xSpan = el.querySelector('.remove-x');
      if (xSpan) xSpan.style.color = '#ef4444';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = 'rgba(167, 139, 250, 0.06)';
      el.style.borderColor = 'rgba(167, 139, 250, 0.2)';
      el.style.color = '#c4b5fd';
      const xSpan = el.querySelector('.remove-x');
      if (xSpan) xSpan.style.color = 'rgba(167, 139, 250, 0.6)';
    });

    el.addEventListener('click', () => {
      orderedBlocks.splice(idx, 1);
      scrambledPool.push(blockText);
      renderBlocksUI();
    });
    orderedContainer.appendChild(el);
  });

  const isFull = orderedBlocks.length === (currentSyntaxCard.blocks || []).length;
  const orderedBox = document.getElementById('syntax-blocks-ordered');
  const jointsInput = document.getElementById('syntax-joints-input');
  const checkBtn = document.getElementById('check-syntax-btn');
  const layoutContainer = document.getElementById('syntax-sentence-layout-container');

  if (isFull) {
    const isCorrect = orderedBlocks.every((val, index) => val === currentSyntaxCard.blocks[index]);
    if (isCorrect) {
      orderedBox.style.borderColor = 'var(--success)';
      jointsInput.removeAttribute('disabled');
      checkBtn.removeAttribute('disabled');
      layoutContainer.style.display = 'block';

      // Blank out joints
      let sentenceWithBlanks = currentSyntaxCard.example || '';
      (currentSyntaxCard.joints || []).forEach(joint => {
        const regex = new RegExp('\\b' + joint.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
        sentenceWithBlanks = sentenceWithBlanks.replace(regex, '[ ______ ]');
      });
      document.getElementById('syntax-sentence-layout').textContent = sentenceWithBlanks;
      setTimeout(() => jointsInput.focus(), 100);
    } else {
      orderedBox.style.borderColor = 'var(--danger)';
      jointsInput.setAttribute('disabled', 'true');
      checkBtn.setAttribute('disabled', 'true');
      layoutContainer.style.display = 'none';
    }
  } else {
    orderedBox.style.borderColor = 'var(--border)';
    jointsInput.setAttribute('disabled', 'true');
    checkBtn.setAttribute('disabled', 'true');
    layoutContainer.style.display = 'none';
  }
}

function renderSyntaxFrontFace(card) {
  currentSyntaxCard = card;
  
  if (!card.blocks || card.blocks.length === 0) {
    const fallbackText = card.example || card.word || '';
    if (fallbackText) {
      // Split by commas, or every 3-4 words if no commas.
      if (fallbackText.includes(',')) {
        card.blocks = fallbackText.split(',').map(s => s.trim() + (fallbackText.indexOf(s) < fallbackText.lastIndexOf(',') ? ',' : '')).filter(Boolean);
      } else {
        const words = fallbackText.split(' ');
        card.blocks = [];
        for (let i = 0; i < words.length; i += 3) {
          card.blocks.push(words.slice(i, i + 3).join(' '));
        }
      }
      card.joints = card.joints || [];
    }
  }

  orderedBlocks = [];
  scrambledPool = shuffleArray(card.blocks || []);
  
  document.getElementById('syntax-front-translation').textContent = card.translation || 'No translation added.';
  document.getElementById('syntax-front-pattern').textContent = card.definition || 'No template description.';
  
  chrome.storage?.local.get('spelt_target_lang', (res) => {
    const lang = res.spelt_target_lang || 'fa';
    let targetLangName = 'Translation';
    if (lang === 'es') targetLangName = 'Translation (Spanish)';
    else if (lang === 'fr') targetLangName = 'Translation (French)';
    else if (lang === 'de') targetLangName = 'Translation (German)';
    else if (lang === 'it') targetLangName = 'Translation (Italian)';
    else if (lang === 'pt') targetLangName = 'Translation (Portuguese)';
    else if (lang === 'ru') targetLangName = 'Translation (Russian)';
    else if (lang === 'ar') targetLangName = 'Translation (Arabic)';
    else if (lang === 'fa') targetLangName = 'Translation (Farsi)';
    else if (lang === 'zh') targetLangName = 'Translation (Chinese)';
    else if (lang === 'ja') targetLangName = 'Translation (Japanese)';
    else if (lang === 'ko') targetLangName = 'Translation (Korean)';
    else if (lang === 'tr') targetLangName = 'Translation (Turkish)';
    
    const labelEl = document.getElementById('syntax-translation-label');
    if (labelEl) labelEl.textContent = targetLangName;
  });
  
  const jointsInput = document.getElementById('syntax-joints-input');
  if (jointsInput) {
    jointsInput.value = '';
    jointsInput.setAttribute('disabled', 'true');
  }
  const checkBtn = document.getElementById('check-syntax-btn');
  if (checkBtn) {
    checkBtn.setAttribute('disabled', 'true');
  }

  renderBlocksUI();
}

export async function loadPracticeDeck() {
  refreshReviewedWordDay();
  const words = await getWords();
  const mode = getPracticeMode();
  
  if (mode === 'syntax') {
    setDueCards(words.filter(w => w.practiceType === 'syntax' && w.nextDate <= Date.now() && !w.mastered && !hasReviewedWord(w.id, mode)));
  } else if (mode === 'recall') {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'recall') && w.meaningNextDate <= Date.now() && !w.mastered && !hasReviewedWord(w.id, mode)));
  } else {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'spelling') && w.nextDate <= Date.now() && !w.mastered && !hasReviewedWord(w.id, mode)));
  }
  
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) {
    cardEl.style.display = 'none'; emptyEl.style.display = 'flex';
    // Trigger AI session summary
    triggerSessionSummary();
    return;
  }

  cardEl.style.display = 'flex'; emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  // Reset AI hint and feedback bubbles
  const hintBubble = document.getElementById('ai-hint-bubble');
  if (hintBubble) hintBubble.style.display = 'none';
  const backHintBubble = document.getElementById('back-ai-hint-bubble');
  if (backHintBubble) {
    backHintBubble.style.display = 'none';
    backHintBubble.style.top = 'auto';
    backHintBubble.style.right = '14px';
    backHintBubble.style.bottom = '74px';
    backHintBubble.style.left = '14px';
  }
  const fbBubble = document.getElementById('ai-feedback-row');
  if (fbBubble) {
    fbBubble.style.display = 'none';
    fbBubble.style.top = 'auto';
    fbBubble.style.right = '14px';
    fbBubble.style.bottom = '74px';
    fbBubble.style.left = '14px';
  }

  const card = dueCards[0];

  // Show AI components if configured
  setupAIHintButton(card);
  setupBackAIHintButton(card);
  setupAISyntaxExplain(card);
  setupAIWritingPractice(card);
  setupAISpellingFeedback();
  
  populateFrontFace(card);
}

export function populateFrontFace(card) {
  const mode = getPracticeMode();

  const frontSpellingContent = document.getElementById('front-spelling-content');
  const frontRecallContent = document.getElementById('front-recall-content');
  const frontSyntaxContent = document.getElementById('front-syntax-content');
  
  const frontSpellingWrapper = document.getElementById('front-spelling-wrapper');
  const frontRecallWrapper = document.getElementById('front-recall-wrapper');
  const frontSyntaxWrapper = document.getElementById('front-syntax-wrapper');

  if (mode === 'syntax') {
    if (frontSpellingContent) frontSpellingContent.style.display = 'none';
    if (frontRecallContent) frontRecallContent.style.display = 'none';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'flex';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'none';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'none';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'flex';

    renderSyntaxFrontFace(card);
  } else if (mode === 'recall') {
    if (frontSpellingContent) frontSpellingContent.style.display = 'none';
    if (frontRecallContent) frontRecallContent.style.display = 'flex';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'none';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'none';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'flex';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'none';

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
      levelContainer.style.display = displayLevel ? 'inline-block' : 'none';
    }

    // Populate and show example sentence on front for Recall mode context clues
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    const exampleContainer = document.getElementById('recall-front-example-container');
    if (rawExample) {
      document.getElementById('recall-front-example').textContent = rawExample;
      if (exampleContainer) exampleContainer.style.display = 'block';
    } else {
      if (exampleContainer) exampleContainer.style.display = 'none';
    }

    // Set dynamic hint/prompt text
    const hintEl = document.getElementById('recall-front-hint');
    if (hintEl) {
      hintEl.textContent = card.word.trim().includes(' ') 
        ? 'What does this expression mean?' 
        : 'What does this word mean?';
    }
  } else {
    if (frontSpellingContent) frontSpellingContent.style.display = 'flex';
    if (frontRecallContent) frontRecallContent.style.display = 'none';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'none';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'flex';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'none';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'none';

    document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
    document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
    document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

    const transEl = document.getElementById('practice-translation');
    if (transEl) {
      if (card.translation) {
        transEl.innerHTML = `<span class="translation-blur-text">${card.translation}</span><span class="translation-reveal-hint">Reveal</span>`;
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
      levelContainer.style.display = displayLevel ? 'block' : 'none';
    }

    const exampleContainer = document.getElementById('practice-example-container');
    const exampleTransEl = document.getElementById('practice-example-translation');
    const translateBtn = document.getElementById('practice-translate-btn');
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (rawExample) {
      document.getElementById('practice-example').textContent = censorWordInExample(card.word, rawExample);
      exampleContainer.style.display = 'block';
    } else exampleContainer.style.display = 'none';
    if (exampleTransEl) { exampleTransEl.style.display = 'none'; exampleTransEl.textContent = ''; }
    if (translateBtn) translateBtn.classList.remove('active');

    const audioContainer = document.getElementById('practice-audio-container');
    if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  // Handle Cambridge pronunciation auto-fetch if level doesn't exist
  if (card.word && !card.level && card.practiceType !== 'syntax') {
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
            levelContainer.style.display = 'inline-block';
          }
        } else {
          const levelEl = document.getElementById('practice-level');
          const levelContainer = document.getElementById('practice-level-container');
          if (levelEl && levelContainer) {
            levelEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
            levelContainer.style.display = 'block';
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
    const isDue = mode === 'recall' ? f.meaningNextDate <= now : f.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? f.practiceType === 'syntax'
      : mode === 'recall'
        ? (f.practiceType === 'both' || f.practiceType === 'recall') && f.meaningNextDate <= now
        : (f.practiceType === 'both' || f.practiceType === 'spelling');
    return !f.mastered && isDue && matchesMode && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  due.push(...fresh.filter(w => {
    const isDue = mode === 'recall' ? w.meaningNextDate <= now : w.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? w.practiceType === 'syntax'
      : mode === 'recall'
        ? (w.practiceType === 'both' || w.practiceType === 'recall')
        : (w.practiceType === 'both' || w.practiceType === 'spelling');
    return isDue && matchesMode && !w.mastered && !ids.has(w.id) && !hasReviewedWord(w.id, mode);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id, isFlipped = document.getElementById('popup-deck-card')?.classList.contains('flipped');
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

async function setupAIHintButton(card) {
  const hintBtn = document.getElementById('ai-hint-btn');
  const hintBubble = document.getElementById('ai-hint-bubble');
  const hintText = document.getElementById('ai-hint-text');
  const regenBtn = document.getElementById('ai-hint-regen');
  const closeBtn = document.getElementById('ai-hint-close');
  if (!hintBtn || !hintBubble || !hintText) return;

  // Reset dragged positions back to default stylesheet styles on setup
  hintBubble.style.top = 'auto';
  hintBubble.style.right = '14px';
  hintBubble.style.bottom = '62px';
  hintBubble.style.left = '14px';

  // Make the hint bubble draggable
  makeElementDraggable(hintBubble);

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    hintBtn.style.display = 'none';
    return;
  }

  hintBtn.style.display = 'inline-flex';
  hintBubble.style.display = 'none';
  hintText.textContent = '';

  const handleHintRequest = async (forceRegen = false) => {
    hintText.textContent = forceRegen ? 'Regenerating...' : 'Asking AI Coach...';
    hintBubble.style.display = 'block';
    try {
      let hint = '';
      if (card.practiceType === 'syntax') {
        hint = await generateSyntaxPuzzleHint(card);
      } else {
        if (forceRegen) {
          card.aiHint = null;
        }
        hint = await generateHint(card);
      }
      hintText.innerHTML = hint.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" style="margin-bottom: 4px;">${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('');
    } catch (err) {
      hintText.textContent = `Could not generate hint: ${err.message}`;
    }
  };

  // Wire event listeners by replacing/cloning buttons to strip previous listeners
  const newHintBtn = hintBtn.cloneNode(true);
  hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
  newHintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hintBubble.style.display === 'block') {
      hintBubble.style.display = 'none';
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
      hintBubble.style.display = 'none';
    });
  }
}

async function setupBackAIHintButton(card) {
  const hintBtn = document.getElementById('back-ai-hint-btn');
  const hintBubble = document.getElementById('back-ai-hint-bubble');
  const hintText = document.getElementById('back-ai-hint-text');
  const regenBtn = document.getElementById('back-ai-hint-regen');
  const closeBtn = document.getElementById('back-ai-hint-close');
  if (!hintBtn || !hintBubble || !hintText) return;

  // Reset dragged positions back to default stylesheet styles on setup
  hintBubble.style.top = 'auto';
  hintBubble.style.right = '14px';
  hintBubble.style.bottom = '74px';
  hintBubble.style.left = '14px';

  // Make the hint bubble draggable
  makeElementDraggable(hintBubble);

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    hintBtn.style.display = 'none';
    return;
  }

  hintBtn.style.display = 'inline-flex';
  hintBubble.style.display = 'none';
  hintText.textContent = '';

  const handleHintRequest = async (forceRegen = false) => {
    hintText.textContent = forceRegen ? 'Regenerating...' : 'Asking AI Coach...';
    hintBubble.style.display = 'block';
    try {
      let hint = '';
      if (card.practiceType === 'syntax') {
        hint = await generateSyntaxPuzzleHint(card);
      } else {
        if (forceRegen) {
          card.aiHint = null;
        }
        hint = await generateHint(card);
      }
      hintText.innerHTML = hint.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" style="margin-bottom: 4px;">${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('');
    } catch (err) {
      hintText.textContent = `Could not generate hint: ${err.message}`;
    }
  };

  // Wire event listeners by replacing/cloning buttons to strip previous listeners
  const newHintBtn = hintBtn.cloneNode(true);
  hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
  newHintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hintBubble.style.display === 'block') {
      hintBubble.style.display = 'none';
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
      hintBubble.style.display = 'none';
    });
  }
}

async function triggerSessionSummary() {
  const container = document.getElementById('ai-session-summary');
  const textEl = document.getElementById('ai-session-summary-text');
  if (!container || !textEl) return;

  container.style.display = 'none';
  textEl.textContent = '';

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) return;

  const stats = getSessionStats();
  if (stats.totalReviewed === 0) return;

  // Show button-gated AI summary — no auto-fire to prevent rate limits
  container.style.display = 'block';
  textEl.innerHTML = `<button type="button" id="ai-session-summary-btn" style="background: hsla(260, 60%, 50%, 0.15); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; padding: 5px 12px; font-size: 0.68rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s ease; margin: 4px auto;">✨ <span>Generate AI Summary</span></button>`;
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

async function setupAISyntaxExplain(card) {
  const explainBtn = document.getElementById('ai-syntax-explain-btn');
  const explanationBubble = document.getElementById('ai-syntax-explanation-bubble');
  if (!explainBtn || !explanationBubble) return;

  explanationBubble.style.display = 'none';
  const textEl = document.getElementById('ai-syntax-explanation-text');
  if (textEl) textEl.innerHTML = '';

  const isConfigured = await isGeminiConfigured();
  const mode = getPracticeMode();

  if (!isConfigured || mode !== 'syntax') {
    explainBtn.style.display = 'none';
    return;
  }

  explainBtn.style.display = 'inline-flex';

  const handleExplainRequest = async () => {
    const textEl = document.getElementById('ai-syntax-explanation-text');
    if (!textEl) return;
    textEl.innerHTML = '<span style="color: var(--text-muted);">Asking AI Coach...</span>';
    explanationBubble.style.display = 'block';
    try {
      const explanation = await generateSyntaxExplanation(card);
      textEl.innerHTML = explanation.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" style="margin-bottom: 4px;">${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('');
    } catch (err) {
      textEl.textContent = `Could not generate explanation: ${err.message}`;
    }
  };

  const newExplainBtn = explainBtn.cloneNode(true);
  explainBtn.parentNode.replaceChild(newExplainBtn, explainBtn);
  newExplainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (explanationBubble.style.display === 'block') {
      explanationBubble.style.display = 'none';
    } else {
      handleExplainRequest();
    }
  });

  const closeBtn = document.getElementById('ai-syntax-explain-close');
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      explanationBubble.style.display = 'none';
    });
  }
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
  feedbackEl.style.display = 'none';
  bodyEl.style.display = 'none'; // Collapsed by default!
  if (feedbackContentEl) feedbackContentEl.innerHTML = '';
  if (writingFeedbackTimeoutId) {
    clearTimeout(writingFeedbackTimeoutId);
    writingFeedbackTimeoutId = null;
  }

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    practicePanel.style.display = 'none';
    return;
  }

  practicePanel.style.display = 'flex';
  const mode = getPracticeMode();

  if (mode === 'syntax') {
    if (titleText) titleText.textContent = 'Structure Writing Practice';
    inputEl.setAttribute('placeholder', `Write a sentence following the structure pattern...`);
  } else {
    if (titleText) titleText.textContent = 'Active Vocabulary Practice';
    inputEl.setAttribute('placeholder', `Write a sentence using the word "${card.word}"...`);
  }

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
    
    if (bodyEl.style.display === 'none') {
      bodyEl.style.display = 'flex';
      if (freshToggleText) freshToggleText.textContent = 'Collapse';
      if (freshToggleIcon) freshToggleIcon.style.transform = 'rotate(180deg)';
      inputEl.focus();
    } else {
      bodyEl.style.display = 'none';
      if (freshToggleText) freshToggleText.textContent = 'Start Practice';
      if (freshToggleIcon) freshToggleIcon.style.transform = 'rotate(0deg)';
    }
  });

  const showFeedback = (html, autoHideDuration) => {
    if (writingFeedbackTimeoutId) {
      clearTimeout(writingFeedbackTimeoutId);
      writingFeedbackTimeoutId = null;
    }
    if (feedbackContentEl) {
      feedbackContentEl.innerHTML = html;
    } else {
      feedbackEl.innerHTML = html;
    }
    feedbackEl.style.display = 'block';

    if (autoHideDuration) {
      writingFeedbackTimeoutId = setTimeout(() => {
        feedbackEl.style.display = 'none';
        writingFeedbackTimeoutId = null;
      }, autoHideDuration);
    }
  };

  const handleVerifyRequest = async () => {
    const userText = inputEl.value.trim();
    if (!userText) {
      showFeedback('<span style="color: var(--danger); font-size: 0.65rem;">Please write a sentence first.</span>', 0);
      return;
    }

    showFeedback('<span style="color: var(--text-muted); font-size: 0.65rem;">AI Coach is grading your sentence...</span>', 0);
    verifyBtn.setAttribute('disabled', 'true');

    try {
      const feedback = await verifyPracticeWriting(card, userText, mode);
      showFeedback(feedback, 0); // No timer: user closes it manually
    } catch (err) {
      showFeedback(`<span style="color: var(--danger); font-size: 0.65rem;">Could not verify sentence: ${err.message}</span>`, 0);
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
      feedbackEl.style.display = 'none';
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
      fbRow.style.display = 'none';
    });
  }
}

/**
 * Make an absolute positioned element draggable within the card face limits
 * Uses high-performance cached variables to avoid layout thrashing stutters
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
