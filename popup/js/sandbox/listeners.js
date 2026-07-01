import { handleVerify } from './verify.js';
import { handleManualCorrection } from './manual_correct.js';
import { handleFeedbackClick } from './click_delegator.js';
import { playWordAudio } from '../../../shared/storage.js';
import { acceptSuggestion } from './accept.js';
import { showManualCorrectionForm } from './manual_form.js';

export function registerSandboxListeners(reloadVaultList, loadPracticeDeck) {
  document.getElementById('quick-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault(); await handleVerify(reloadVaultList);
  });

  document.getElementById('word-input')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const inputVal = e.target.value.trim();
      if (inputVal) { e.preventDefault(); await handleVerify(reloadVaultList); }
    }
  });

  const feedbackMsg = document.getElementById('feedback-msg');
  if (!feedbackMsg) return;

  feedbackMsg.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && e.target.id === 'manual-correction-input') {
      e.preventDefault();
      const correctVal = e.target.value.trim();
      const originalVal = document.getElementById('manual-correction-btn')?.getAttribute('data-original-word');
      const wrongVal = document.getElementById('manual-correction-btn')?.getAttribute('data-wrong-attempt') || '';
      if (correctVal && originalVal) await handleManualCorrection(correctVal, originalVal, wrongVal, reloadVaultList, loadPracticeDeck);
    }
  });

  feedbackMsg.addEventListener('click', (e) => handleFeedbackClick(e, reloadVaultList, loadPracticeDeck));

  window.addEventListener('keydown', async (e) => {
    const sandboxTab = document.getElementById('sandbox-tab');
    const isSandboxActive = sandboxTab && (sandboxTab.classList.contains('active') || window.getComputedStyle(sandboxTab).display !== 'none');
    if (!isSandboxActive) return;

    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'search'].includes(active.type)));

    if (feedbackMsg.style.display === 'none') return;

    if ((e.key === 't' || e.key === 'T') && !isTyping) {
      e.preventDefault(); feedbackMsg.querySelector('.translate-example-btn')?.click(); return;
    }

    const acceptBtn = document.querySelector('.accept-suggestion-btn');
    const rejectBtn = document.querySelector('.reject-suggestion-btn');
    const acceptAnywayBtn = document.querySelector('.accept-anyway-btn');
    const editCorrectionBtn = document.querySelector('.edit-correction-btn');

    if (acceptAnywayBtn && editCorrectionBtn) {
      if (e.key === 'Enter' && !isTyping) { e.preventDefault(); acceptAnywayBtn.click(); }
      else if (e.key === 'Escape') { e.preventDefault(); editCorrectionBtn.click(); }
      return;
    }

    if (acceptBtn && rejectBtn) {
      if (e.key === 'Enter' && !isTyping) {
        e.preventDefault();
        const suggestion = acceptBtn.getAttribute('data-suggestion');
        const original = acceptBtn.getAttribute('data-original');
        if (suggestion && original) await acceptSuggestion(suggestion, original, reloadVaultList, loadPracticeDeck);
      } else if ((e.key === ' ' || e.code === 'Space') && !isTyping) {
        e.preventDefault();
        const audioBtn = feedbackMsg.querySelector('.audio-play-btn');
        if (audioBtn) {
          const word = audioBtn.getAttribute('data-word');
          const accent = audioBtn.getAttribute('data-accent') || 'us';
          if (word) playWordAudio(word, accent).catch(() => {});
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const original = rejectBtn.getAttribute('data-original');
        if (original) await showManualCorrectionForm(original);
      }
    } else {
      if (e.key === 'Enter' && !isTyping) { e.preventDefault(); document.getElementById('word-input')?.focus(); }
      else if ((e.key === ' ' || e.code === 'Space') && !isTyping) {
        e.preventDefault();
        const audioBtn = feedbackMsg.querySelector('.audio-play-btn');
        if (audioBtn) {
          const word = audioBtn.getAttribute('data-word');
          const accent = audioBtn.getAttribute('data-accent') || 'us';
          if (word) playWordAudio(word, accent).catch(() => {});
        }
      } else if (e.key === 'Escape') {
        e.preventDefault(); feedbackMsg.style.display = 'none'; document.getElementById('word-input')?.focus();
      }
    }
  });
}
