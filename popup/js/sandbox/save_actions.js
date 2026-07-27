import { addWord, registerMisspelling, translateWord, getFallbackExample } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons } from './helpers.js';
import { escapeHtml } from '../../../shared/dom.js';

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
      Object.assign(banner.style, {
        background: 'hsla(155, 65%, 48%, 0.12)',
        border: '1px solid var(--success)',
        color: 'var(--primary-light)',
        padding: '8px',
        borderRadius: 'var(--radius-md)',
        marginBottom: '12px',
        fontSize: '0.72rem',
        textAlign: 'center',
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: '1',
        maxHeight: '40px',
        overflow: 'hidden'
      });
      
      let typeLabel = 'Spelling';
      if (practiceType === 'recall') typeLabel = 'Recall';
      if (practiceType === 'both') typeLabel = 'Spelling & Recall';
      banner.innerHTML = `Word <strong>"${escapeHtml(word)}"</strong> added for <strong>${escapeHtml(typeLabel)}</strong> practice!`;
      
      const closeBtn = feedbackMsg.querySelector('.feedback-close-btn');
      if (closeBtn) {
        closeBtn.after(banner);
      } else {
        feedbackMsg.prepend(banner);
      }

      // Auto-dismiss after 4s.
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
        <div class="sandbox-action-wrap sandbox-action-wrap-col">
          <button type="button" class="submit-btn sandbox-edit-btn btn-compact-edit" 
            data-word="${word.replace(/"/g, '&quot;')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Edit Target/Details</span>
          </button>
          <p class="sandbox-status-note sandbox-status-note-inline">Correct spelling! (Already in vault)</p>
        </div>
      `;
    }
    
    if (reloadVaultCallback) await reloadVaultCallback();
    if (loadPracticeCallback) await loadPracticeCallback();
  } catch (err) {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    
    const errContainer = document.createElement('div');
    Object.assign(errContainer.style, {
      color: 'var(--danger)',
      fontSize: '0.68rem',
      marginTop: '6px',
      textAlign: 'center'
    });
    errContainer.textContent = `Error: ${err.message}`;
    btn.parentNode.after(errContainer);
    setTimeout(() => errContainer.remove(), 4000);
  }
}

export async function saveManualAnyway(correctWord, originalWord, wrongAttempt = '', reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p class="text-primary-light">Saving...</p>';
  try {
    const def = 'Custom word entry';
    const partOfSpeech = '';
    const example = getFallbackExample(correctWord, partOfSpeech);
    
    let translation = '';
    try { translation = await translateWord(correctWord); } catch {}

    await registerMisspelling(correctWord, originalWord, { definition: def, transcription: '/--/', partOfSpeech, example });
    if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
      await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: '/--/', partOfSpeech, example });
    }

    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 class="feedback-title-success">Correction Saved!</h4>
      <p class="feedback-subtext">Added <strong>${escapeHtml(correctWord)}</strong> (${escapeHtml(originalWord)} saved as misspelling).</p>
      
      <div class="feedback-details">
        <div class="feedback-meta-row">
          ${translation ? `<span class="feedback-badge trans">${escapeHtml(translation)}</span>` : ''}
        </div>
        <p class="feedback-definition"><strong>Definition:</strong> ${escapeHtml(def)}</p>
      </div>
      ${renderAudioButtons(correctWord)}
    `;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultCallback) await reloadVaultCallback();
    if (loadPracticeCallback) await loadPracticeCallback();
  } catch (err) {
    feedbackMsg.innerHTML = `${closeBtnHtml}<p class="text-danger">Error: ${escapeHtml(err.message)}</p>`;
  }
}
