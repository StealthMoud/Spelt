import { getWords, translateWord, fetchDynamicDefinition, fetchDynamicExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';
import { escapeHtml } from '../../../shared/dom.js';

export async function renderMisspellingCard(originalWord, suggestions, activeIndex) {
  const feedbackMsg = document.getElementById('feedback-msg');
  const suggestion = suggestions[activeIndex];
  feedbackMsg.innerHTML = '<p class="text-primary-light">Retrieving suggestions...</p>';
  const defResult = await fetchDynamicDefinition(suggestion);
  let def = defResult.definition, ipa = '', partOfSpeech = '', example = '', level = defResult.level || '';
  try {
    const cambridge = await fetchCambridgePronunciation(suggestion);
    ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.usIpa} (US) / ${cambridge.ukIpa} (UK)`) : (cambridge.usIpa || cambridge.ukIpa || '');
    if (!level) level = cambridge.level || '';
  } catch (_) {}

  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
  if (response.ok) {
    const data = await response.json();
    if (!def) def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
    if (!ipa) ipa = data[0].phonetics.find(p => p.text)?.text || '';
    partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
    example = extractExample(data[0]);
  }
  if (!ipa) ipa = '/--/';
  if (!example) example = await fetchDynamicExample(suggestion) || getFallbackExample(suggestion, partOfSpeech);
  
  const words = await getWords();
  const existing = words.find(w => w.word.toLowerCase() === suggestion.toLowerCase());
  const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
  let translation = '';
  try { translation = await translateWord(suggestion); } catch (_) {}

  let altChips = '';
  const alts = suggestions.filter((_, i) => i !== activeIndex);
  if (alts.length > 0) {
    altChips = `<p class="suggestions-label">Other suggestions: ` +
      alts.map(alt => `<button type="button" class="alt-suggestion-chip" data-index="${suggestions.indexOf(alt)}">${escapeHtml(alt)}</button>`).join('') + `</p>`;
  }
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 class="feedback-title-danger">Misspelling Detected</h4>
    <p class="misspell-prompt">"${escapeHtml(originalWord)}" is incorrect. Did you mean:</p>
    <p class="misspell-suggestion">${escapeHtml(suggestion)}${ipa !== '/--/' ? ` <span class="misspell-ipa">${escapeHtml(ipa)}</span>` : ''}</p>
    ${renderAudioButtons(suggestion)}
    
    <div class="feedback-details">
      <div class="feedback-meta-row">
        ${partOfSpeech ? `<span class="feedback-badge pos">${escapeHtml(partOfSpeech)}</span>` : ''}
        ${level ? `<span class="feedback-badge level">${escapeHtml(level)}</span>` : ''}
        ${translation ? `<span class="feedback-badge trans">${escapeHtml(translation)}</span>` : ''}
      </div>
      <p class="feedback-definition"><strong>Definition:</strong> ${escapeHtml(def)}</p>
      ${example ? `
        <div class="feedback-example" data-word="${escapeHtml(suggestion)}">
          <div class="feedback-flex-row">
            <span class="clue-label clue-label-inline">Example</span>
            <div class="feedback-btn-group">
              <button type="button" class="play-example-btn" title="Pronounce Example" data-sentence="${escapeHtml(example)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <button type="button" class="translate-example-btn" title="Translate Example">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              </button>
            </div>
          </div>
          <p class="feedback-example-text">"${escapeHtml(example)}"</p>
          <p class="feedback-example-translation hidden">${exampleTranslation ? `"${escapeHtml(exampleTranslation)}"` : ''}</p>
        </div>
      ` : ''}
    </div>
    
    ${altChips}
    <div class="feedback-btn-row">
      <button type="button" class="submit-btn accept-suggestion-btn btn-compact-auto" data-suggestion="${escapeHtml(suggestion)}" data-original="${escapeHtml(originalWord)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Accept</span>
      </button>
      <button type="button" class="submit-btn reject-suggestion-btn btn-compact-auto btn-danger-soft" data-original="${escapeHtml(originalWord)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>Reject</span>
      </button>
    </div>
  `;
}
