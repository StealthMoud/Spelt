import { addWord, registerMisspelling, translateWord, getFallbackExample } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons } from './helpers.js';

export async function handleAddToVault(btn, reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving to vault...</p>';
  try {
    const word = btn.getAttribute('data-word');
    const definition = btn.getAttribute('data-definition') || 'No definition found';
    const transcription = btn.getAttribute('data-transcription') || '';
    const partOfSpeech = btn.getAttribute('data-part-of-speech') || '';
    const example = btn.getAttribute('data-example') || '';
    const translation = btn.getAttribute('data-translation') || '';
    const level = btn.getAttribute('data-level') || '';

    await addWord({ word, definition, transcription, partOfSpeech, example, translation, level });

    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 4px;">✅ Added to Vault</h4>
      <p style="font-size: 0.68rem; margin: 4px 0;">Word <strong>"${word}"</strong> has been successfully added to your practice vault.</p>
    `;
    
    if (reloadVaultCallback) await reloadVaultCallback();
    if (loadPracticeCallback) await loadPracticeCallback();
  } catch (err) {
    feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`;
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
