import { peekCard, getPracticeMode, getSessionStats, resetSessionStats } from './state.js';
import { generateHint, generateSessionSummary, verifyPracticeWriting } from './ai_helpers.js';
import { escapeHtml } from '../../../shared/dom.js';
import { isGeminiConfigured, atomicUpdate } from '../../../shared/storage.js';
import { makeElementDraggable } from '../components/draggable.js';

let writingFeedbackTimeoutId = null;
let cardScope = null;

/** Abort the previous card's scoped listeners and create a fresh scope. */
function resetCardScope() {
  cardScope?.abort();
  cardScope = new AbortController();
  return cardScope.signal;
}

async function mountHintPanel({ btnId, bubbleId, textId, regenId, closeId, defaultBottom }, card, signal) {
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
      hintText.innerHTML = hint.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" class="ai-hint-line">${escapeHtml(l)}</div>`).join('');
    } catch (err) {
      hintText.textContent = `Could not generate hint: ${err.message}`;
    }
  };

  hintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hintBubble.classList.contains('hidden')) {
      hintBubble.classList.add('hidden');
    } else {
      handleHintRequest(false);
    }
  }, { signal });

  if (regenBtn) {
    regenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHintRequest(true);
    }, { signal });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hintBubble.classList.add('hidden');
    }, { signal });
  }
}

export function setupAIHintButton(card, signal) {
  return mountHintPanel({
    btnId: 'ai-hint-btn',
    bubbleId: 'ai-hint-bubble',
    textId: 'ai-hint-text',
    regenId: 'ai-hint-regen',
    closeId: 'ai-hint-close',
    defaultBottom: '62px'
  }, card, signal);
}

export function setupBackAIHintButton(card, signal) {
  return mountHintPanel({
    btnId: 'back-ai-hint-btn',
    bubbleId: 'back-ai-hint-bubble',
    textId: 'back-ai-hint-text',
    regenId: 'back-ai-hint-regen',
    closeId: 'back-ai-hint-close',
    defaultBottom: '74px'
  }, card, signal);
}

export async function triggerSessionSummary() {
  const container = document.getElementById('ai-session-summary');
  const textEl = document.getElementById('ai-session-summary-text');
  if (!container || !textEl) return;

  container.classList.add('hidden');
  textEl.textContent = '';

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) return;

  const stats = getSessionStats();
  if (stats.totalReviewed === 0) return;

  container.classList.remove('hidden');
  textEl.innerHTML = `<button type="button" id="ai-session-summary-btn" class="ai-coach-trigger-btn btn-summary-center"><span>Generate AI Summary</span></button>`;
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

export async function setupAIWritingPractice(card, signal) {
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

  feedbackEl.style.top = 'auto';
  feedbackEl.style.right = '14px';
  feedbackEl.style.bottom = '74px';
  feedbackEl.style.left = '14px';

  makeElementDraggable(feedbackEl);

  inputEl.value = '';
  feedbackEl.classList.add('hidden');
  bodyEl.classList.add('hidden');
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

  const toggleText = document.getElementById('ai-writing-practice-toggle-text');
  const toggleIcon = document.getElementById('ai-writing-practice-toggle-icon');

  if (toggleText) toggleText.textContent = 'Start Practice';
  if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';

  headerEl.addEventListener('click', (e) => {
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
  }, { signal });

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
      showFeedback(feedback, 0);
    } catch (err) {
      showFeedback(`Could not verify sentence: ${err.message}`, 0);
    } finally {
      verifyBtn.removeAttribute('disabled');
    }
  };

  verifyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleVerifyRequest();
  }, { signal });

  if (feedbackCloseBtn) {
    feedbackCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      feedbackEl.classList.add('hidden');
      if (writingFeedbackTimeoutId) {
        clearTimeout(writingFeedbackTimeoutId);
        writingFeedbackTimeoutId = null;
      }
    }, { signal });
  }
}

export function setupAISpellingFeedback(signal) {
  const fbRow = document.getElementById('ai-feedback-row');
  const closeBtn = document.getElementById('ai-feedback-close');
  if (!fbRow) return;

  makeElementDraggable(fbRow);

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fbRow.classList.add('hidden');
    }, { signal });
  }
}

export { resetCardScope };
