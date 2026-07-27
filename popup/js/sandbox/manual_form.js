import { findSuggestions } from './spelling.js';
import { closeBtnHtml } from './helpers.js';

export async function showManualCorrectionForm(originalWord, suggestions = [], wrongAttempt = '') {
  const f = document.getElementById('feedback-msg');
  const queryWord = wrongAttempt || originalWord;
  if (suggestions.length === 0) suggestions = await findSuggestions(queryWord);

  const title = wrongAttempt ? 'Word Not Found' : 'Spelling Error';
  const desc = wrongAttempt 
    ? `"${wrongAttempt}" is not recognized either. If you know the correct spelling, enter it below:`
    : `"${originalWord}" is not recognized. If you know the correct spelling, enter it below:`;
  
  const chipsHtml = suggestions.length > 0 
    ? `<p class="suggestions-label">Suggestions: ` +
      suggestions.map(s => `<button type="button" class="manual-suggest-chip" data-word="${s}">${s}</button>`).join('') + `</p>`
    : '';

  f.innerHTML = `
    ${closeBtnHtml}
    <h4 class="feedback-title-danger">${title}</h4>
    <p class="feedback-desc-text">${desc}</p>
    <div class="manual-input-wrap">
      <input type="text" id="manual-correction-input" class="field manual-input-field" placeholder="Correct spelling..." value="${wrongAttempt}">
      <button type="button" id="manual-correction-btn" data-original-word="${originalWord}" data-wrong-attempt="${wrongAttempt}" class="submit-btn manual-input-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Save</span>
      </button>
    </div>
    ${chipsHtml}
  `;
  document.getElementById('manual-correction-input')?.focus();
}
