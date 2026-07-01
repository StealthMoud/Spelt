import { getWords, saveWords, translateWord, fetchDynamicDefinition, fetchDynamicExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';

export async function handleCorrectSpelling(apiData, word, reloadVaultListCallback) {
  const defResult = await fetchDynamicDefinition(word);
  const def = defResult.definition || apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  let ipa = '', level = defResult.level || '';
  try {
    const cambridge = await fetchCambridgePronunciation(word);
    ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`) : (cambridge.ukIpa || cambridge.usIpa || '');
    if (!level) level = cambridge.level || '';
  } catch (_) {}
  if (!ipa) ipa = apiData.phonetics.find(p => p.text)?.text || '/--/';
  
  const partOfSpeech = apiData.meanings[0]?.partOfSpeech || '';
  const example = extractExample(apiData) || await fetchDynamicExample(word) || getFallbackExample(word, partOfSpeech);
  
  let translation = '';
  try { translation = await translateWord(word); } catch (_) {}

  try {
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase());
    if (existing && level && !existing.level) {
      existing.level = level; await saveWords(words);
    }
    const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
    const wordLevel = (existing && existing.level) ? existing.level : level;
    let subtext = '';
    
    if (existing) {
      subtext = `
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
    } else {
      subtext = `
        <div style="display: flex; gap: 6px; justify-content: center; margin-top: 8px; flex-wrap: wrap;">
          <button type="button" class="submit-btn add-to-vault-btn spelling-add-btn" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}"
            data-practice-type="spelling"
            style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(160, 60%, 45%, 0.12); border-color: hsla(160, 60%, 45%, 0.4); color: #2ecc71;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Spelling</span>
          </button>
          <button type="button" class="submit-btn add-to-vault-btn recall-add-btn" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}"
            data-practice-type="recall"
            style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(210, 60%, 45%, 0.12); border-color: hsla(210, 60%, 45%, 0.4); color: #3498db;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Recall</span>
          </button>
          <button type="button" class="submit-btn add-to-vault-btn both-add-btn" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}"
            data-practice-type="both"
            style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(280, 60%, 45%, 0.12); border-color: hsla(280, 60%, 45%, 0.4); color: #9b59b6;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>+ Both</span>
          </button>
          <button type="button" class="submit-btn sandbox-edit-btn" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}"
            style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(200, 80%, 15%, 0.2); border-color: var(--primary-light); color: var(--primary-light);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Customize...</span>
          </button>
        </div>
        <p style="font-size: 0.62rem; color: var(--text-muted); text-align: center; margin-top: 4px; margin-bottom: 0;">Correct spelling! (Not saved to vault)</p>
      `;
    }
    
    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correct Spelling!</h4>
      <p style="margin: 6px 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.02em;">${word} <span style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${ipa}</span></p>
      ${renderAudioButtons(word)}
      
      <div class="feedback-details">
        <div class="feedback-meta-row">
          ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
          ${wordLevel ? `<span class="feedback-badge level">${wordLevel}</span>` : ''}
          ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
        </div>
        <p class="feedback-definition"><strong>Definition:</strong> ${def}</p>
        ${example ? `
          <div class="feedback-example" data-word="${word}">
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
      <div id="sandbox-action-container" style="width: 100%; text-align: center;">${subtext}</div>
    `;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultListCallback) await reloadVaultListCallback();
  } catch (err) {
    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>
    `;
  }
}
