import { getWords, translateWord, enrichWord, getFallbackExample, getStored, isGeminiConfigured, askGemini, atomicUpdate, getSpellingVariant } from '../../../shared/storage.js';
import { closeBtnHtml, renderAudioButtons, extractExample } from './helpers.js';
import { showConfirm } from '../vault/confirm.js';
import { escapeHtml } from '../../../shared/dom.js';
import { getLanguageName } from '../../../src/core/languages.js';
import { buildEnrichmentPrompt } from '../../../shared/ai/prompts.js';

export async function handleCorrectSpelling(apiData, word, reloadVaultListCallback, { aiEntry } = {}) {
  const detailsPromise = aiEntry ? Promise.resolve([aiEntry, aiEntry.translation]) : Promise.all([enrichWord(word), translateWord(word).catch(() => '')]);
  const enriched = aiEntry || {};
  const def = enriched.definition || apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  let ipa = enriched.ipa || enriched.transcription || apiData.phonetics.find(p => p.text)?.text || '/--/';
  let level = enriched.level || '';

  const partOfSpeech = apiData.meanings[0]?.partOfSpeech || '';
  const example = extractExample(apiData) || enriched.example || getFallbackExample(word, partOfSpeech);
  
  const translation = aiEntry?.translation || '';

  try {
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase());
    if (existing && level && !existing.level) {
      await atomicUpdate(async (list) => {
        const w = list.find(x => x.word.toLowerCase() === word.toLowerCase());
        if (w && !w.level) w.level = level;
      });
    }
    const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
    const wordLevel = (existing && existing.level) ? existing.level : level;
    
    const isAiConfigured = await isGeminiConfigured();
    let subtext = '';
    
    if (existing) {
      subtext = `
        <div class="sandbox-action-wrap">
          <button type="button" class="submit-btn sandbox-edit-btn btn-compact-edit" 
            data-word="${word.replace(/"/g, '&quot;')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Edit Target/Details</span>
          </button>
          ${isAiConfigured ? `
            <button type="button" class="submit-btn sandbox-ai-enhance-btn btn-compact-ai btn-ai-purple" 
              data-word="${word.replace(/"/g, '&quot;')}" 
              data-definition="${def.replace(/"/g, '&quot;')}" 
              data-transcription="${ipa.replace(/"/g, '&quot;')}" 
              data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
              data-example="${example.replace(/"/g, '&quot;')}" 
              data-translation="${translation.replace(/"/g, '&quot;')}"
              data-level="${wordLevel.replace(/"/g, '&quot;')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>AI Enhance</span>
            </button>
          ` : ''}
        </div>
        <p class="sandbox-status-note">${aiEntry ? 'AI explanation · Already in vault' : 'Correct spelling! (Already in vault)'}</p>
      `;
    } else {
      subtext = `
        <div class="sandbox-action-wrap">
          <div class="sandbox-add-group">
            <select class="field select-input sandbox-add-select" id="sandbox-add-type-select" aria-label="Select Practice Mode">
              <option value="spelling">+ Spelling</option>
              <option value="recall">+ Recall</option>
              <option value="both">+ Both</option>
            </select>
            <button type="button" class="submit-btn add-to-vault-btn spelling-add-btn btn-compact-ai btn-add-green" 
              id="sandbox-primary-add-btn"
              data-word="${word.replace(/"/g, '&quot;')}" 
              data-definition="${def.replace(/"/g, '&quot;')}" 
              data-transcription="${ipa.replace(/"/g, '&quot;')}" 
              data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
              data-example="${example.replace(/"/g, '&quot;')}" 
              data-translation="${translation.replace(/"/g, '&quot;')}"
              data-level="${wordLevel.replace(/"/g, '&quot;')}"
              data-practice-type="spelling">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-svg-sm"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add</span>
            </button>
          </div>
          ${isAiConfigured ? `
            <button type="button" class="submit-btn sandbox-ai-enhance-btn btn-compact-ai btn-ai-purple" 
              data-word="${word.replace(/"/g, '&quot;')}" 
              data-definition="${def.replace(/"/g, '&quot;')}" 
              data-transcription="${ipa.replace(/"/g, '&quot;')}" 
              data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
              data-example="${example.replace(/"/g, '&quot;')}" 
              data-translation="${translation.replace(/"/g, '&quot;')}"
              data-level="${wordLevel.replace(/"/g, '&quot;')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>AI Enhance</span>
            </button>
          ` : ''}
          <button type="button" class="submit-btn sandbox-edit-btn btn-compact-ai btn-edit-teal" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            <span>Customize...</span>
          </button>
        </div>
        <p class="sandbox-status-note-sm">${aiEntry ? 'AI explanation · Save it when you’re ready' : 'Correct spelling! (Not saved to vault)'}</p>
      `;
    }
    
    // Look up US/UK spelling variant
    const spellingVariant = getSpellingVariant(word);
    const variantHtml = spellingVariant && spellingVariant.us !== spellingVariant.uk
      ? `<p class="variant-row"><span class="variant-label">US:</span> <strong>${escapeHtml(spellingVariant.us)}</strong> <span class="variant-sep">·</span> <span class="variant-label">UK:</span> <strong>${escapeHtml(spellingVariant.uk)}</strong></p>`
      : '';

    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}
      <h4 class="feedback-title-success">${aiEntry ? 'AI explanation' : 'Correct Spelling!'}</h4>
      <p class="misspell-suggestion">${escapeHtml(word)} <span id="feedback-ipa-display" class="misspell-ipa">${escapeHtml(ipa)}</span></p>
      ${variantHtml}
      ${renderAudioButtons(word)}
      
      <div class="feedback-details">
        <div class="feedback-meta-row" id="feedback-meta-row">
          ${partOfSpeech ? `<span class="feedback-badge pos" id="feedback-pos-badge">${escapeHtml(partOfSpeech)}</span>` : ''}
          ${wordLevel ? `<span class="feedback-badge level" id="feedback-level-badge">${escapeHtml(wordLevel)}</span>` : ''}
          ${translation ? `<span class="feedback-badge trans" id="feedback-trans-badge">${escapeHtml(translation)}</span>` : ''}
        </div>
        <p class="feedback-definition" id="feedback-def-display"><strong>Definition:</strong> ${escapeHtml(def)}</p>
        ${example ? `
          <div class="feedback-example" data-word="${escapeHtml(word)}" id="feedback-example-container">
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
            <p class="feedback-example-text" id="feedback-example-text">"${escapeHtml(example)}"</p>
            <p class="feedback-example-translation hidden">${exampleTranslation ? `"${escapeHtml(exampleTranslation)}"` : ''}</p>
          </div>
        ` : ''}
      </div>
      <div id="sandbox-action-container" class="sandbox-action-container">${subtext}</div>
    `;
    // Keep optional network requests off the path to the first usable result.
    const definitionNode = document.getElementById('feedback-def-display');
    void detailsPromise.then(async ([details, translated]) => {
      if (!definitionNode.isConnected) return; // A newer lookup or dismissal owns the card now.
      const feedback = document.getElementById('feedback-msg');
      const transcription = details.ipa || ipa;
      const resolvedLevel = wordLevel || details.level || '';
      document.getElementById('feedback-ipa-display').textContent = transcription;
      const metadata = document.getElementById('feedback-meta-row');
      if (resolvedLevel && !document.getElementById('feedback-level-badge')) {
        const badge = document.createElement('span');
        badge.id = 'feedback-level-badge'; badge.className = 'feedback-badge level';
        badge.textContent = resolvedLevel; metadata.append(badge);
      }
      if (translated && !document.getElementById('feedback-trans-badge')) {
        const badge = document.createElement('span');
        badge.id = 'feedback-trans-badge'; badge.className = 'feedback-badge trans';
        badge.textContent = translated; metadata.append(badge);
      }
      feedback.querySelectorAll('[data-word]').forEach(button => {
        if (button.dataset.word.toLowerCase() !== word.toLowerCase()) return;
        if ('transcription' in button.dataset) button.dataset.transcription = transcription;
        if ('level' in button.dataset) button.dataset.level = resolvedLevel;
        if ('translation' in button.dataset) button.dataset.translation = translated;
      });
      if (existing && resolvedLevel && !existing.level) {
        await atomicUpdate(async list => {
          const saved = list.find(item => item.word.toLowerCase() === word.toLowerCase());
          if (saved && !saved.level) saved.level = resolvedLevel;
        });
      }
    }).catch(() => {});
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultListCallback) await reloadVaultListCallback();
  } catch (err) {
    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}<p class="text-danger">Error: ${err.message}</p>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon icon-svg-sm"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
    <span>Enhancing...</span>
  `;

  try {
    const targetLang = await getStored('spelt_target_lang') || 'fa';
    const targetLangName = getLanguageName(targetLang);

    const prompt = buildEnrichmentPrompt(word, { definition: def, transcription: ipa, partOfSpeech: pos, translation, level, example }, targetLangName);

    const aiData = await askGemini(prompt);

    // Update DOM displays
    const defDisplay = document.getElementById('feedback-def-display');
    if (defDisplay) defDisplay.innerHTML = `<strong>Definition:</strong> ${escapeHtml(aiData.definition)}`;

    const ipaDisplay = document.getElementById('feedback-ipa-display');
    if (ipaDisplay) ipaDisplay.textContent = aiData.transcription;

    const exampleText = document.getElementById('feedback-example-text');
    if (exampleText) exampleText.textContent = `"${aiData.example}"`;

    const metaRow = document.getElementById('feedback-meta-row');
    if (metaRow) {
      metaRow.innerHTML = '';
      if (aiData.partOfSpeech) {
        metaRow.innerHTML += `<span class="feedback-badge pos" id="feedback-pos-badge">${escapeHtml(aiData.partOfSpeech)}</span>`;
      }
      if (aiData.level) {
        metaRow.innerHTML += `<span class="feedback-badge level" id="feedback-level-badge">${escapeHtml(aiData.level.toUpperCase())}</span>`;
      }
      if (aiData.translation) {
        metaRow.innerHTML += `<span class="feedback-badge trans" id="feedback-trans-badge">${escapeHtml(aiData.translation)}</span>`;
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
    await atomicUpdate(async (list) => {
      const existingWord = list.find(w => w.word.toLowerCase() === word.toLowerCase());
      if (existingWord) {
        existingWord.definition = aiData.definition;
        existingWord.transcription = aiData.transcription;
        existingWord.partOfSpeech = aiData.partOfSpeech;
        existingWord.translation = aiData.translation;
        existingWord.level = aiData.level.toUpperCase().trim();
        existingWord.example = aiData.example;
      }
    });
    if (reloadVaultListCallback) await reloadVaultListCallback();

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Enhanced!</span>
    `;
    btn.style.color = '#10b981';
    btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    btn.style.background = 'rgba(16, 185, 129, 0.1)';
  } catch (err) {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
    showConfirm('AI Enhancement Failed', err.message, null, false);
  }
}
