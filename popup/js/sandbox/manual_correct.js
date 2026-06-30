import { fetchCambridgePronunciation, fetchDynamicDefinition, fetchDynamicExample, getFallbackExample, registerMisspelling, translateWord, getWords } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';
import { findSuggestions } from './spelling.js';

export async function handleManualCorrection(correctWord, originalWord, wrongAttempt = '', reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  try {
    feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
    
    const words = await getWords();
    const exists = words.some(w => w.word.toLowerCase() === correctWord.toLowerCase());

    let ipa = '', level = '';
    try {
      const cambridge = await fetchCambridgePronunciation(correctWord);
      ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`) : (cambridge.ukIpa || cambridge.usIpa || '');
      level = cambridge.level || '';
    } catch (_) {}

    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(correctWord.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      const defResult = await fetchDynamicDefinition(correctWord);
      const def = defResult.definition || data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      if (!level) level = defResult.level || '';
      if (!ipa) ipa = data[0].phonetics.find(p => p.text)?.text || '';
      if (!ipa) ipa = '/--/';
      const partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
      const example = extractExample(data[0]) || await fetchDynamicExample(correctWord) || getFallbackExample(correctWord, partOfSpeech);
      const existing = words.find(w => w.word.toLowerCase() === correctWord.toLowerCase());
      const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
      
      let translation = '';
      try { translation = await translateWord(correctWord); } catch (_) {}

      await registerMisspelling(correctWord, originalWord, { definition: def, transcription: ipa, partOfSpeech, example, exampleTranslation, level });
      if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
        await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: ipa, partOfSpeech, example, exampleTranslation, level });
      }
      
      feedbackMsg.innerHTML = `
        ${closeBtnHtml}
        <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
        <p style="margin: 4px 0; font-size: 0.72rem;">Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).</p>
        <div class="feedback-details">
          <div class="feedback-meta-row">
            ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
            ${level ? `<span class="feedback-badge level">${level}</span>` : ''}
            ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
          </div>
          <p class="feedback-definition"><strong>Definition:</strong> ${def}</p>
          ${example ? `<div class="feedback-example" data-word="${correctWord}">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="clue-label" style="margin: 0;">Example</span>
                <div style="display: flex; gap: 4px;">
                  <button type="button" class="play-example-btn" title="Pronounce Example" data-sentence="${example.replace(/"/g, '&quot;')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                  <button type="button" class="translate-example-btn" title="Translate Example">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                  </button>
                </div>
              </div>
              <p class="feedback-example-text">"${example}"</p>
              <p class="feedback-example-translation" style="display: none;">${exampleTranslation ? `"${exampleTranslation}"` : ''}</p>
            </div>` : ''}
        </div>
        ${renderAudioButtons(correctWord)}
        <div style="display: flex; justify-content: center; margin-top: 8px;">
          <button type="button" class="submit-btn sandbox-edit-btn" 
            data-word="${correctWord.replace(/"/g, '&quot;')}"
            style="width: auto; padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 11px; height: 11px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Edit Target/Details</span>
          </button>
        </div>
      `;
      document.getElementById('word-input').value = '';
      document.getElementById('word-input')?.blur();
      if (reloadVaultCallback) await reloadVaultCallback();
      if (loadPracticeCallback) await loadPracticeCallback();
    } else {
      feedbackMsg.setAttribute('data-correct-word', correctWord);
      feedbackMsg.setAttribute('data-original-word', originalWord);
      feedbackMsg.setAttribute('data-wrong-attempt', wrongAttempt);
      const suggestions = await findSuggestions(correctWord);
      feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify(suggestions));
      feedbackMsg.innerHTML = `
        ${closeBtnHtml}
        <h4 style="color: var(--warning); margin: 0 0 4px;">⚠️ Unrecognized Word</h4>
        <p style="font-size: 0.72rem; margin: 8px 0; line-height: 1.4;">"${correctWord}" is not recognized in the dictionary. It might be misspelled.</p>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button type="button" class="submit-btn accept-anyway-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Save Anyway</span>
          </button>
          <button type="button" class="submit-btn edit-correction-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem; background: hsla(5, 80%, 15%, 0.3); border-color: var(--danger); color: var(--danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Edit Spelling</span>
          </button>
        </div>
      `;
    }
  } catch (err) { feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}
