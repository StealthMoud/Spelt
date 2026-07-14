import { getWords, registerMisspelling, fetchCambridgePronunciation, fetchDynamicDefinition, getFallbackExample } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';

export async function acceptSuggestion(suggestion, original, reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving...</p>';
  
  const words = await getWords();
  const exists = words.some(w => w.word.toLowerCase() === suggestion.toLowerCase());

  const defResult = await fetchDynamicDefinition(suggestion);
  let def = defResult.definition, ipa = '', partOfSpeech = '', example = '', level = defResult.level || '';
  try {
    const cambridge = await fetchCambridgePronunciation(suggestion);
    ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.usIpa} (US) / ${cambridge.ukIpa} (UK)`) : (cambridge.usIpa || cambridge.ukIpa || '');
    if (!level) level = cambridge.level || '';
  } catch (_) {}

  let isInvalidWord = false;
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(suggestion.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      if (!def || def === 'No definition found') def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      if (!ipa) ipa = data[0].phonetics.find(p => p.text)?.text || '';
      partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
      example = extractExample(data[0]);
    } else if (response.status === 404) {
      if (!def || def === 'No definition found') isInvalidWord = true;
    }
  } catch (_) {}

  if (isInvalidWord) {
    feedbackMsg.setAttribute('data-correct-word', suggestion);
    feedbackMsg.setAttribute('data-original-word', original);
    feedbackMsg.setAttribute('data-wrong-attempt', '');
    feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify([]));
    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--warning); margin: 0 0 4px;">⚠️ Unrecognized Suggestion</h4>
      <p style="font-size: 0.72rem; margin: 8px 0; line-height: 1.4;">"${suggestion}" is not recognized in the dictionary. It might be misspelled.</p>
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
    return;
  }

  if (!ipa) ipa = '/--/';
  await registerMisspelling(suggestion, original, { definition: def, transcription: ipa, partOfSpeech, example, level });
  const exampleText = example ? `<p style="font-size: 0.65rem; color: var(--primary-light); font-style: italic; margin: 4px 0 0;">"${example}"</p>` : '';
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved</h4>
    <p style="font-size: 0.68rem; margin: 4px 0;">${exists ? `Updated existing word <strong>"${suggestion}"</strong> in practice queue.` : `Added correct word <strong>"${suggestion}"</strong> to practice queue.`}</p>
    ${exampleText}
    <div style="display: flex; justify-content: center; margin-top: 8px;">
      <button type="button" class="submit-btn sandbox-edit-btn" 
        data-word="${suggestion.replace(/"/g, '&quot;')}"
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
}
