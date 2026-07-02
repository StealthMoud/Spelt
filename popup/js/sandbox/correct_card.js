import { getWords, saveWords, translateWord, fetchDynamicDefinition, fetchDynamicExample, getFallbackExample, fetchCambridgePronunciation, getStored } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';
import { isGeminiConfigured, askGemini } from '../practice/ai_helpers.js';

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
    
    const isAiConfigured = await isGeminiConfigured();
    let subtext = '';
    
    if (existing) {
      subtext = `
        <div style="display: flex; gap: 6px; justify-content: center; margin-top: 8px; flex-wrap: wrap;">
          <button type="button" class="submit-btn sandbox-edit-btn" 
            data-word="${word.replace(/"/g, '&quot;')}"
            style="width: auto; padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 11px; height: 11px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Edit Target/Details</span>
          </button>
          ${isAiConfigured ? `
            <button type="button" class="submit-btn sandbox-ai-enhance-btn" 
              data-word="${word.replace(/"/g, '&quot;')}" 
              data-definition="${def.replace(/"/g, '&quot;')}" 
              data-transcription="${ipa.replace(/"/g, '&quot;')}" 
              data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
              data-example="${example.replace(/"/g, '&quot;')}" 
              data-translation="${translation.replace(/"/g, '&quot;')}"
              data-level="${wordLevel.replace(/"/g, '&quot;')}"
              style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(260, 60%, 45%, 0.12); border-color: hsla(260, 60%, 45%, 0.4); color: #c084fc;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>AI Enhance</span>
            </button>
          ` : ''}
        </div>
        <p style="font-size: 0.68rem; color: var(--text-muted); margin: 4px 0 0; text-align: center;">Correct spelling! (Already in vault)</p>
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
          ${isAiConfigured ? `
            <button type="button" class="submit-btn sandbox-ai-enhance-btn" 
              data-word="${word.replace(/"/g, '&quot;')}" 
              data-definition="${def.replace(/"/g, '&quot;')}" 
              data-transcription="${ipa.replace(/"/g, '&quot;')}" 
              data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
              data-example="${example.replace(/"/g, '&quot;')}" 
              data-translation="${translation.replace(/"/g, '&quot;')}"
              data-level="${wordLevel.replace(/"/g, '&quot;')}"
              style="width: auto; padding: 4px 10px; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 4px; background: hsla(260, 60%, 45%, 0.12); border-color: hsla(260, 60%, 45%, 0.4); color: #c084fc;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>AI Enhance</span>
            </button>
          ` : ''}
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
      <p style="margin: 6px 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.02em;">${word} <span id="feedback-ipa-display" style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${ipa}</span></p>
      ${renderAudioButtons(word)}
      
      <div class="feedback-details">
        <div class="feedback-meta-row" id="feedback-meta-row">
          ${partOfSpeech ? `<span class="feedback-badge pos" id="feedback-pos-badge">${partOfSpeech}</span>` : ''}
          ${wordLevel ? `<span class="feedback-badge level" id="feedback-level-badge">${wordLevel}</span>` : ''}
          ${translation ? `<span class="feedback-badge trans" id="feedback-trans-badge">${translation}</span>` : ''}
        </div>
        <p class="feedback-definition" id="feedback-def-display"><strong>Definition:</strong> ${def}</p>
        ${example ? `
          <div class="feedback-example" data-word="${word}" id="feedback-example-container">
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
            <p class="feedback-example-text" id="feedback-example-text">"${example}"</p>
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

export async function handleAiEnhance(btn, reloadVaultListCallback) {
  if (btn.disabled) return;
  
  const word = btn.getAttribute('data-word');
  const def = btn.getAttribute('data-definition');
  const ipa = btn.getAttribute('data-transcription');
  const pos = btn.getAttribute('data-part-of-speech');
  const example = btn.getAttribute('data-example');
  const translation = btn.getAttribute('data-translation');
  const level = btn.getAttribute('data-level');

  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon" style="width: 10px; height: 10px; margin-right: 4px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
    <span>Enhancing...</span>
  `;

  try {
    const targetLang = await getStored('spelt_target_lang') || 'fa';
    let targetLangName = 'Farsi (Persian)';
    if (targetLang === 'es') targetLangName = 'Spanish';
    else if (targetLang === 'fr') targetLangName = 'French';
    else if (targetLang === 'de') targetLangName = 'German';
    else if (targetLang === 'it') targetLangName = 'Italian';
    else if (targetLang === 'pt') targetLangName = 'Portuguese';
    else if (targetLang === 'ru') targetLangName = 'Russian';
    else if (targetLang === 'ar') targetLangName = 'Arabic';
    else if (targetLang === 'fa') targetLangName = 'Farsi (Persian)';
    else if (targetLang === 'zh') targetLangName = 'Chinese Simplified';
    else if (targetLang === 'ja') targetLangName = 'Japanese';
    else if (targetLang === 'ko') targetLangName = 'Korean';
    else if (targetLang === 'tr') targetLangName = 'Turkish';

    const prompt = `You are a professional lexicographer. Improve, correct, and enrich the vocabulary details for the English word/phrase "${word}".
Here is the current stored draft:
{
  "definition": "${def.replace(/"/g, '\\"')}",
  "transcription": "${ipa.replace(/"/g, '\\"')}",
  "partOfSpeech": "${pos.replace(/"/g, '\\"')}",
  "translation": "${translation.replace(/"/g, '\\"')}",
  "level": "${level.replace(/"/g, '\\"')}",
  "example": "${example.replace(/"/g, '\\"')}"
}

Please:
1. Enrich the definition to be clean, accurate, and easy to understand in English.
2. Ensure the UK/US IPA pronunciation transcription is correct and clear (e.g. /iˈnɪɡ.mə/).
3. Ensure part of speech is correct (noun, verb, phrasal verb, adjective, etc.).
4. Refine the translation in ${targetLangName}.
5. Select the single best CEFR level (A1, A2, B1, B2, C1, or C2).
6. Provide a premium, natural academic/IELTS-style context sentence containing the word.

Respond ONLY with a JSON object matching this schema:
{
  "definition": "...",
  "transcription": "...",
  "partOfSpeech": "...",
  "translation": "...",
  "level": "...",
  "example": "..."
}`;

    const aiData = await askGemini(prompt);

    // Update DOM displays
    const defDisplay = document.getElementById('feedback-def-display');
    if (defDisplay) defDisplay.innerHTML = `<strong>Definition:</strong> ${aiData.definition}`;

    const ipaDisplay = document.getElementById('feedback-ipa-display');
    if (ipaDisplay) ipaDisplay.textContent = aiData.transcription;

    const exampleText = document.getElementById('feedback-example-text');
    if (exampleText) exampleText.textContent = `"${aiData.example}"`;

    const metaRow = document.getElementById('feedback-meta-row');
    if (metaRow) {
      metaRow.innerHTML = '';
      if (aiData.partOfSpeech) {
        metaRow.innerHTML += `<span class="feedback-badge pos" id="feedback-pos-badge">${aiData.partOfSpeech}</span>`;
      }
      if (aiData.level) {
        metaRow.innerHTML += `<span class="feedback-badge level" id="feedback-level-badge">${aiData.level.toUpperCase()}</span>`;
      }
      if (aiData.translation) {
        metaRow.innerHTML += `<span class="feedback-badge trans" id="feedback-trans-badge">${aiData.translation}</span>`;
      }
    }

    // Update all button attributes
    const buttons = document.querySelectorAll('.add-to-vault-btn, .sandbox-edit-btn, .sandbox-ai-enhance-btn');
    buttons.forEach(b => {
      b.setAttribute('data-definition', aiData.definition);
      b.setAttribute('data-transcription', aiData.transcription);
      b.setAttribute('data-part-of-speech', aiData.partOfSpeech);
      b.setAttribute('data-translation', aiData.translation);
      b.setAttribute('data-level', aiData.level);
      b.setAttribute('data-example', aiData.example);
    });

    // Update play example sentence data attribute
    const playBtn = document.querySelector('.feedback-example .play-example-btn');
    if (playBtn) {
      playBtn.setAttribute('data-sentence', aiData.example);
    }

    // If word is already in vault, update it immediately in database
    const list = await getWords();
    const existingWord = list.find(w => w.word.toLowerCase() === word.toLowerCase());
    if (existingWord) {
      existingWord.definition = aiData.definition;
      existingWord.transcription = aiData.transcription;
      existingWord.partOfSpeech = aiData.partOfSpeech;
      existingWord.translation = aiData.translation;
      existingWord.level = aiData.level.toUpperCase().trim();
      existingWord.example = aiData.example;
      await saveWords(list);
      if (reloadVaultListCallback) await reloadVaultListCallback();
    }

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; margin-right: 4px;"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Enhanced!</span>
    `;
    btn.style.color = '#10b981';
    btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    btn.style.background = 'rgba(16, 185, 129, 0.1)';
  } catch (err) {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    alert(`AI Enhancement failed: ${err.message}`);
  }
}
