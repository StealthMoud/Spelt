import { getWords, registerMisspelling, fetchCambridgePronunciation, fetchDynamicDefinition } from '../../../shared/storage.js';
import { closeBtnHtml, extractExample } from './helpers.js';
import { escapeHtml } from '../../../shared/dom.js';

export async function acceptSuggestion(suggestion, original, reloadVaultCallback, loadPracticeCallback) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p class="text-primary-light">Saving...</p>';
  
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
      <h4 class="feedback-title-warning">Unrecognized Suggestion</h4>
      <p class="feedback-desc-text">"${escapeHtml(suggestion)}" is not recognized in the dictionary. It might be misspelled.</p>
      <div class="feedback-btn-row">
        <button type="button" class="submit-btn accept-anyway-btn btn-compact-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Save Anyway</span>
        </button>
        <button type="button" class="submit-btn edit-correction-btn btn-compact-auto btn-danger-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span>Edit Spelling</span>
        </button>
      </div>
    `;
    return;
  }

  if (!ipa) ipa = '/--/';
  await registerMisspelling(suggestion, original, { definition: def, transcription: ipa, partOfSpeech, example, level });
  const exampleText = example ? `<p class="feedback-example-italic">"${escapeHtml(example)}"</p>` : '';
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 class="feedback-title-success">Correction Saved</h4>
    <p class="feedback-subtext">${exists ? `Updated existing word <strong>"${escapeHtml(suggestion)}"</strong> in practice queue.` : `Added correct word <strong>"${escapeHtml(suggestion)}"</strong> to practice queue.`}</p>
    ${exampleText}
    <div class="feedback-center-row">
      <button type="button" class="submit-btn sandbox-edit-btn btn-compact-edit" 
        data-word="${escapeHtml(suggestion)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
        <span>Edit Target/Details</span>
      </button>
    </div>
  `;
  document.getElementById('word-input').value = '';
  document.getElementById('word-input')?.blur();
  if (reloadVaultCallback) await reloadVaultCallback();
  if (loadPracticeCallback) await loadPracticeCallback();
}
