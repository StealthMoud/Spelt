import { peekCard, getPracticeMode, getSessionStats, resetSessionStats } from './state.js';
import { generateHint, generateSessionSummary, verifyPracticeWriting } from './ai_helpers.js';
import { escapeHtml } from '../../../shared/dom.js';
import { isGeminiConfigured, atomicUpdate } from '../../../shared/storage.js';

let writingFeedbackTimeoutId = null;
let cardScope = null;

/** Abort the previous card's scoped listeners and create a fresh scope. */
export function resetCardScope() {
  cardScope?.abort();
  cardScope = new AbortController();
  return cardScope.signal;
}

function openBottomSheet(title, htmlContent) {
  const sheet = document.getElementById('practice-bottom-sheet');
  const titleEl = document.getElementById('sheet-title');
  const contentEl = document.getElementById('sheet-content');
  const closeBtn = document.getElementById('sheet-close-btn');

  if (!sheet || !titleEl || !contentEl) return;
  titleEl.textContent = title;
  contentEl.innerHTML = htmlContent;
  sheet.classList.remove('hidden');

  if (closeBtn) closeBtn.onclick = () => sheet.classList.add('hidden');
}

async function mountHintPanel({ btnId }, card, signal) {
  const hintBtn = document.getElementById(btnId);
  if (!hintBtn) return;

  const isConfigured = await isGeminiConfigured();
  if (!isConfigured) {
    hintBtn.classList.add('hidden');
    return;
  }

  hintBtn.classList.remove('hidden');

  const handleHintRequest = async (forceRegen = false) => {
    const currentCard = card || peekCard();
    if (!currentCard) return;
    openBottomSheet('AI Memory Hint', `<p class="text-primary-light">${forceRegen ? 'Regenerating...' : 'Asking AI Coach...'}</p>`);
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
      const formattedHint = hint.split('\n').filter(l => l.trim()).map(l => `<div dir="auto" class="ai-hint-line">${escapeHtml(l)}</div>`).join('');
      openBottomSheet('AI Memory Hint', `
        <div class="ai-sheet-body">
          ${formattedHint}
          <button type="button" id="ai-sheet-regen-btn" class="submit-btn btn-compact-auto text-mt-xs">Regenerate Hint</button>
        </div>
      `);
      document.getElementById('ai-sheet-regen-btn')?.addEventListener('click', () => handleHintRequest(true));
    } catch (err) {
      openBottomSheet('AI Memory Hint', `<p class="text-danger">Could not generate hint: ${escapeHtml(err.message)}</p>`);
    }
  };

  hintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleHintRequest(false);
  }, { signal });
}

export function setupAIHintButton(card, signal) {
  return mountHintPanel({ btnId: 'ai-hint-btn' }, card, signal);
}

export function setupBackAIHintButton(card, signal) {
  return mountHintPanel({ btnId: 'back-ai-hint-btn' }, card, signal);
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
  if (toggleIcon) toggleIcon.classList.remove('rotate-180');

  headerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const freshToggleText = document.getElementById('ai-writing-practice-toggle-text');
    const freshToggleIcon = document.getElementById('ai-writing-practice-toggle-icon');

    if (bodyEl.classList.contains('hidden')) {
      bodyEl.classList.remove('hidden');
      if (freshToggleText) freshToggleText.textContent = 'Collapse';
      if (freshToggleIcon) freshToggleIcon.classList.add('rotate-180');
      inputEl.focus();
    } else {
      bodyEl.classList.add('hidden');
      if (freshToggleText) freshToggleText.textContent = 'Start Practice';
      if (freshToggleIcon) freshToggleIcon.classList.remove('rotate-180');
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
      span.className = 'text-muted-xs';
      span.textContent = content;
      targetEl.appendChild(span);
    } else if (content && typeof content === 'object') {
      const isOk = content.verdict === 'correct';
      const badge = document.createElement('span');
      badge.className = isOk ? 'badge badge-success' : 'badge badge-danger';
      badge.textContent = isOk ? '✓ Correct Usage' : '✗ Incorrect';
      targetEl.appendChild(badge);

      if (content.correction) {
        const corrDiv = document.createElement('div');
        corrDiv.className = 'text-mt-xs';
        const strong = document.createElement('strong');
        strong.textContent = 'Correction: ';
        corrDiv.appendChild(strong);
        corrDiv.appendChild(document.createTextNode(content.correction));
        targetEl.appendChild(corrDiv);
      }

      if (content.feedback) {
        const fbDiv = document.createElement('div');
        fbDiv.className = 'text-mt-xs';
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

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fbRow.classList.add('hidden');
    }, { signal });
  }
}

