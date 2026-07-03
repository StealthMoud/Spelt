import { addWord, registerMisspelling, translateWord, getFallbackExample } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons } from './helpers.js';

export async function handleAddToVault(btn, reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  if (!feedbackMsg) return;

  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span>Saving...</span>';
  btn.disabled = true;

  try {
    const word = btn.getAttribute('data-word');
    const definition = btn.getAttribute('data-definition') || 'No definition found';
    const transcription = btn.getAttribute('data-transcription') || '';
    const partOfSpeech = btn.getAttribute('data-part-of-speech') || '';
    const example = btn.getAttribute('data-example') || '';
    const translation = btn.getAttribute('data-translation') || '';
    const level = btn.getAttribute('data-level') || '';
    const practiceType = btn.getAttribute('data-practice-type') || 'spelling';

    await addWord({ word, definition, transcription, partOfSpeech, example, translation, level, practiceType });

    // Prepend a success notification banner at the top of the card details
    if (!feedbackMsg.querySelector('.sandbox-success-banner')) {
      const banner = document.createElement('div');
      banner.className = 'sandbox-success-banner';
      banner.style.cssText = 'background: hsla(155, 65%, 48%, 0.12); border: 1px solid var(--success); color: var(--primary-light); padding: 8px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: 0.72rem; text-align: center; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); opacity: 1; max-height: 40px; overflow: hidden;';
      
      let typeLabel = 'Spelling';
      if (practiceType === 'recall') typeLabel = 'Recall';
      if (practiceType === 'both') typeLabel = 'Spelling & Recall';
      if (practiceType === 'syntax') typeLabel = 'Syntax';
      banner.innerHTML = `✅ Word <strong>"${word}"</strong> added for <strong>${typeLabel}</strong> practice!`;
      
      const closeBtn = feedbackMsg.querySelector('.feedback-close-btn');
      if (closeBtn) {
        closeBtn.after(banner);
      } else {
        feedbackMsg.prepend(banner);
      }

      // Auto-dismiss with a premium slide-up and fade-out animation
      setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-8px)';
        banner.style.maxHeight = '0';
        banner.style.padding = '0';
        banner.style.marginBottom = '0';
        banner.style.border = 'none';
        setTimeout(() => banner.remove(), 500);
      }, 4000);
    }

    // Switch action buttons at the bottom to "Already in vault" status
    const actionContainer = document.getElementById('sandbox-action-container');
    if (actionContainer) {
      actionContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 8px;">
          <button type="button" class="submit-btn sandbox-edit-btn" 
            data-word="${word.replace(/"/g, '&quot;')}"
            style="width: auto; padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 11px; height: 11px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Edit Target/Details</span>
          </button>
          <p style="font-size: 0.68rem; color: var(--text-muted); margin: 0;">Correct spelling! (Already in vault)</p>
        </div>
      `;
    }
    
    if (reloadVaultCallback) await reloadVaultCallback();
    if (loadPracticeCallback) await loadPracticeCallback();
  } catch (err) {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    
    const errContainer = document.createElement('div');
    errContainer.style.cssText = 'color: var(--danger); font-size: 0.68rem; margin-top: 6px; text-align: center;';
    errContainer.textContent = `Error: ${err.message}`;
    btn.parentNode.after(errContainer);
    setTimeout(() => errContainer.remove(), 4000);
  }
}

export async function saveManualAnyway(correctWord, originalWord, wrongAttempt = '', reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving...</p>';
  try {
    const def = 'Custom word entry';
    const partOfSpeech = '';
    const example = getFallbackExample(correctWord, partOfSpeech);
    
    let translation = '';
    try { translation = await translateWord(correctWord); } catch (_) {}

    await registerMisspelling(correctWord, originalWord, { definition: def, transcription: '/--/', partOfSpeech, example });
    if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
      await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: '/--/', partOfSpeech, example });
    }

    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
      <p style="margin: 4px 0; font-size: 0.72rem;">Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).</p>
      
      <div class="feedback-details">
        <div class="feedback-meta-row">
          ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
        </div>
        <p class="feedback-definition"><strong>Definition:</strong> ${def}</p>
      </div>
      ${renderAudioButtons(correctWord)}
    `;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultCallback) await reloadVaultCallback();
    if (loadPracticeCallback) await loadPracticeCallback();
  } catch (err) {
    feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`;
  }
}
