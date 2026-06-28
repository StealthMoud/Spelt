import { getWords, translateWord, fetchDynamicDefinition, fetchDynamicExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';

export async function renderMisspellingCard(originalWord, suggestions, activeIndex) {
  const feedbackMsg = document.getElementById('feedback-msg');
  const suggestion = suggestions[activeIndex];
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Retrieving suggestions...</p>';
  const defResult = await fetchDynamicDefinition(suggestion);
  let def = defResult.definition, ipa = '', partOfSpeech = '', example = '', level = defResult.level || '';
  try {
    const cambridge = await fetchCambridgePronunciation(suggestion);
    ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`) : (cambridge.ukIpa || cambridge.usIpa || '');
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
    altChips = `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 6px 0 2px;">Other suggestions: ` +
      alts.map(alt => `<button type="button" class="alt-suggestion-chip" data-index="${suggestions.indexOf(alt)}">${alt}</button>`).join('') + `</p>`;
  }
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--danger); margin: 0 0 6px;">❌ Misspelling Detected</h4>
    <p style="margin: 6px 0; font-size: 0.74rem;">"${originalWord}" is incorrect. Did you mean:</p>
    <p style="margin: 4px 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.02em; color: var(--primary-light);">${suggestion}${ipa !== '/--/' ? ` <span style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${ipa}</span>` : ''}</p>
    ${renderAudioButtons(suggestion)}
    
    <div class="feedback-details">
      <div class="feedback-meta-row">
        ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
        ${level ? `<span class="feedback-badge level">${level}</span>` : ''}
        ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
      </div>
      <p class="feedback-definition"><strong>Definition:</strong> ${def}</p>
      ${example ? `
        <div class="feedback-example" data-word="${suggestion}">
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
        </div>
      ` : ''}
    </div>
    
    ${altChips}
    <div style="display: flex; gap: 6px; margin-top: 8px;">
      <button type="button" class="submit-btn accept-suggestion-btn" data-suggestion="${suggestion}" data-original="${originalWord}" style="width: auto; padding: 4px 8px; font-size: 0.72rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Accept</span>
      </button>
      <button type="button" class="submit-btn reject-suggestion-btn" data-original="${originalWord}" style="width: auto; padding: 4px 8px; font-size: 0.72rem; background: hsla(5, 80%, 15%, 0.3); border-color: var(--danger); color: var(--danger);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>Reject</span>
      </button>
    </div>
  `;
}
