import { findSuggestions } from './spelling.js';
import { closeBtnHtml } from './helpers.js';

export async function showManualCorrectionForm(originalWord, suggestions = [], wrongAttempt = '') {
  const f = document.getElementById('feedback-msg');
  const queryWord = wrongAttempt || originalWord;
  if (suggestions.length === 0) suggestions = await findSuggestions(queryWord);

  const title = wrongAttempt ? '❌ Word Not Found' : '❌ Spelling Error';
  const desc = wrongAttempt 
    ? `"${wrongAttempt}" is not recognized either. If you know the correct spelling, enter it below:`
    : `"${originalWord}" is not recognized. If you know the correct spelling, enter it below:`;
  
  const chipsHtml = suggestions.length > 0 
    ? `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 6px 0 2px;">Suggestions: ` +
      suggestions.map(s => `<button type="button" class="manual-suggest-chip" data-word="${s}">${s}</button>`).join('') + `</p>`
    : '';

  f.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--danger); margin: 0 0 4px;">${title}</h4>
    <p style="font-size: 0.72rem; margin: 0 0 8px;">${desc}</p>
    <div style="display: flex; gap: 6px;">
      <input type="text" id="manual-correction-input" class="premium-input" placeholder="Correct spelling..." value="${wrongAttempt}" style="width: 140px; padding: 4px 8px; font-size: 0.75rem;">
      <button type="button" id="manual-correction-btn" data-original-word="${originalWord}" data-wrong-attempt="${wrongAttempt}" class="submit-btn" style="width: 60px; padding: 4px; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Save</span>
      </button>
    </div>
    ${chipsHtml}
  `;
  document.getElementById('manual-correction-input')?.focus();
}
