import { getWords, saveWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation, isGeminiConfigured } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, getIsSubmitting, getReviewedWordIds, getPracticeMode, getSessionStats, resetSessionStats } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';
import { generateHint, generateSessionSummary, generateSyntaxExplanation, verifyPracticeWriting } from './ai_helpers.js';

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
  orderedBlocks = [];
  scrambledPool = shuffleArray(card.blocks || []);
  
  document.getElementById('syntax-front-translation').textContent = card.translation || 'No translation added.';
  document.getElementById('syntax-front-pattern').textContent = card.definition || 'No template description.';
  
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
  const words = await getWords();
  const reviewedIds = getReviewedWordIds();
  const mode = getPracticeMode();
  
  if (mode === 'syntax') {
    setDueCards(words.filter(w => w.practiceType === 'syntax' && w.nextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  } else if (mode === 'recall') {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'recall') && w.meaningNextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  } else {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'spelling') && w.nextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
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

  // Reset AI hint bubble
  const hintBubble = document.getElementById('ai-hint-bubble');
  if (hintBubble) hintBubble.style.display = 'none';

  const card = dueCards[0];

  // Show AI hint button if configured
  setupAIHintButton(card);
  setupAISyntaxExplain(card);
  setupAIWritingPractice(card);
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
        
        const all = await getWords(), w = all.find(x => x.id === card.id);
        if (w) { w.level = card.level; w.otherLevels = card.otherLevels; await saveWords(all); }
      }
    }).catch(() => {});
  }
}

export async function syncPracticeDeck() {
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
    const isDue = f.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? f.practiceType === 'syntax'
      : mode === 'recall'
        ? (f.practiceType === 'both' || f.practiceType === 'recall') && f.meaningNextDate <= now
        : (f.practiceType === 'both' || f.practiceType === 'spelling');
    return !f.mastered && isDue && matchesMode && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  const reviewedIds = getReviewedWordIds();
  due.push(...fresh.filter(w => {
    const isDue = mode === 'recall' ? w.meaningNextDate <= now : w.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? w.practiceType === 'syntax'
      : mode === 'recall'
        ? (w.practiceType === 'both' || w.practiceType === 'recall')
        : (w.practiceType === 'both' || w.practiceType === 'spelling');
    return isDue && matchesMode && !w.mastered && !ids.has(w.id) && !reviewedIds.has(w.id);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id, isFlipped = document.getElementById('popup-deck-card')?.classList.contains('flipped');
  if (oldActiveId !== newActiveId || (!isFlipped && !getIsSubmitting())) showPracticeCard();
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
  if (!isConfigured || card.practiceType === 'syntax') {
    hintBtn.style.display = 'none';
    return;
  }

  hintBtn.style.display = 'inline-flex';
  hintBubble.style.display = 'none';
  hintText.textContent = '';

  const handleHintRequest = async (forceRegen = false) => {
    hintText.textContent = forceRegen ? 'Regenerating mnemonic...' : 'Asking AI Coach...';
    hintBubble.style.display = 'block';
    try {
      if (forceRegen) {
        card.aiHint = null;
      }
      const hint = await generateHint(card);
      hintText.textContent = hint;
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

  container.style.display = 'block';
  textEl.textContent = 'Generating AI coaching summary...';

  try {
    const mode = getPracticeMode();
    const summary = await generateSessionSummary({
      ...stats,
      mode: mode.toUpperCase()
    });
    textEl.textContent = summary;
    resetSessionStats(); // Reset after summary shown to avoid duplicate summaries if switching tabs
  } catch (err) {
    textEl.textContent = `Could not load summary: ${err.message}`;
  }
}

async function setupAISyntaxExplain(card) {
  const explainBtn = document.getElementById('ai-syntax-explain-btn');
  const explanationBubble = document.getElementById('ai-syntax-explanation-bubble');
  if (!explainBtn || !explanationBubble) return;

  explanationBubble.style.display = 'none';
  explanationBubble.innerHTML = '';

  const isConfigured = await isGeminiConfigured();
  const mode = getPracticeMode();

  if (!isConfigured || mode !== 'syntax') {
    explainBtn.style.display = 'none';
    return;
  }

  explainBtn.style.display = 'inline-flex';

  const handleExplainRequest = async () => {
    explanationBubble.innerHTML = '<span style="color: var(--text-muted);">Asking AI Coach...</span>';
    explanationBubble.style.display = 'block';
    try {
      const explanation = await generateSyntaxExplanation(card);
      explanationBubble.textContent = explanation;
    } catch (err) {
      explanationBubble.textContent = `Could not generate explanation: ${err.message}`;
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

/**
 * Make an absolute positioned element draggable within the card face limits
 * Uses high-performance cached variables to avoid layout thrashing stutters
 */
function makeElementDraggable(el) {
  let startX = 0, startY = 0;
  let currentLeft = 0, currentTop = 0;

  el.addEventListener('mousedown', dragMouseDown);
  el.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    e.preventDefault();
    
    startX = e.clientX;
    startY = e.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
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
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentLeft = el.offsetLeft;
    currentTop = el.offsetTop;
    
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
    const parentRect = el.parentElement.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const margin = 8;
    
    if (newLeft < margin) newLeft = margin;
    if (newLeft + rect.width > parentRect.width - margin) {
      newLeft = parentRect.width - rect.width - margin;
    }
    if (newTop < margin) newTop = margin;
    if (newTop + rect.height > parentRect.height - margin) {
      newTop = parentRect.height - rect.height - margin;
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


