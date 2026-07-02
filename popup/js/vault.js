import { getWords, saveWords, getStored, isGeminiConfigured, askGemini } from '../../shared/storage.js';
import { showConfirm, showImportOptionsModal } from './vault/confirm.js';
import { openModal, closeModal, currentFormMisspellings, renderPastErrorsList, setCurrentFormMisspellings } from './vault/modal.js';
import { saveWord } from './vault/save.js';
import { renderList, updateBulkUIState } from './vault/list.js';
import { getFilteredWords } from './vault/filter.js';
import { registerAutofillListeners } from './vault/autofill.js';
import { registerAudioListeners } from './vault/audio_listeners.js';
import { initCustomSelects } from './vault/dropdowns.js';
let wordsList = [];
let onVaultUpdatedCallback = null;
let selectedWordIds = new Set();
export { showConfirm, openModal, showImportOptionsModal };

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;
  initCustomSelects();

  document.getElementById('add-word-btn').addEventListener('click', () => openModal());
  document.getElementById('form-cancel-btn').addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); closeModal();
  });
  document.getElementById('word-entry-form').addEventListener('submit', (e) => 
    saveWord(e, currentFormMisspellings, wordsList, reloadVaultList, onVaultUpdatedCallback)
  );

  document.getElementById('form-past-errors-list')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.error-trash-chip');
    if (chip) {
      setCurrentFormMisspellings(currentFormMisspellings.filter(x => x !== chip.getAttribute('data-error')));
      renderPastErrorsList();
    }
  });

  registerAutofillListeners();
  registerAudioListeners();

  const onSearchChange = () => { selectedWordIds.clear(); renderList(wordsList, selectedWordIds, openModal, deleteWord); };
  document.getElementById('vault-search').addEventListener('input', onSearchChange);
  document.getElementById('vault-filter-status')?.addEventListener('change', onSearchChange);
  document.getElementById('vault-sort-field')?.addEventListener('change', onSearchChange);

  document.getElementById('vault-sort-dir-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('vault-sort-dir-btn');
    const next = btn.getAttribute('data-dir') === 'asc' ? 'desc' : 'asc';
    btn.setAttribute('data-dir', next);
    document.getElementById('sort-dir-label').textContent = next.toUpperCase();
    onSearchChange();
  });

  document.getElementById('vault-select-all')?.addEventListener('change', (e) => {
    const filtered = getFilteredWords(wordsList);
    if (e.target.checked) filtered.forEach(w => selectedWordIds.add(w.id));
    else filtered.forEach(w => selectedWordIds.delete(w.id));
    updateBulkUIState(filtered, selectedWordIds);
  });

  document.getElementById('vault-delete-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm('Delete Selected', `Delete all ${selectedWordIds.size} selected words?`, async () => {
      wordsList = wordsList.filter(w => !selectedWordIds.has(w.id));
      await saveWords(wordsList);
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-demaster-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm('Re-study Selected', `Move all ${selectedWordIds.size} selected words back into practice?`, async () => {
      wordsList.forEach(w => {
        if (selectedWordIds.has(w.id)) {
          w.mastered = false; w.rep = 0; w.interval = 1; w.nextDate = Date.now();
        }
      });
      await saveWords(wordsList);
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-enrich-selected')?.addEventListener('click', async () => {
    if (selectedWordIds.size === 0) return;
    
    const isConfigured = await isGeminiConfigured();
    if (!isConfigured) {
      alert('Please configure your Gemini API Key in the Settings tab.');
      return;
    }

    showConfirm('AI Enrich Selected', `This will query Gemini AI to enrich definitions, translations, parts of speech, and IELTS examples for the selected ${selectedWordIds.size} words. This will run sequentially to respect free rate limits. Proceed?`, async () => {
      const idsToEnrich = Array.from(selectedWordIds);
      const total = idsToEnrich.length;
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();

      // Show non-cancelable progress indicator
      showConfirm('AI Enrich Progress', `Enriched 0 of ${total} words...`, null, false);

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

      let done = 0;
      for (const id of idsToEnrich) {
        try {
          const list = await getWords();
          const w = list.find(x => x.id === id);
          if (w) {
            const prompt = `You are a professional lexicographer. Improve, correct, and enrich the vocabulary details for the English word/phrase "${w.word}".
Here is the current stored draft:
{
  "definition": "${(w.definition || '').replace(/"/g, '\\"')}",
  "transcription": "${(w.transcription || '').replace(/"/g, '\\"')}",
  "partOfSpeech": "${(w.partOfSpeech || '').replace(/"/g, '\\"')}",
  "translation": "${(w.translation || '').replace(/"/g, '\\"')}",
  "level": "${(w.level || '').replace(/"/g, '\\"')}",
  "example": "${(w.example || '').replace(/"/g, '\\"')}"
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
            
            // Reload list to prevent concurrent editing issues
            const freshList = await getWords();
            const targetWord = freshList.find(x => x.id === id);
            if (targetWord) {
              if (aiData.definition) targetWord.definition = aiData.definition;
              if (aiData.transcription) targetWord.transcription = aiData.transcription;
              if (aiData.partOfSpeech) targetWord.partOfSpeech = aiData.partOfSpeech;
              if (aiData.translation) targetWord.translation = aiData.translation;
              if (aiData.level) targetWord.level = aiData.level.toUpperCase().trim();
              if (aiData.example) {
                targetWord.example = aiData.example;
                targetWord.exampleTranslation = '';
              }
              await saveWords(freshList);
            }
          }
        } catch (err) {
          console.error(`AI enrichment failed for word ID ${id}:`, err);
        }
        done++;
        const progressMsgEl = document.getElementById('popup-confirm-msg');
        if (progressMsgEl) {
          progressMsgEl.textContent = `Enriched ${done} of ${total} words...`;
        }
        // Rate limit: 3.5s delay to stay under the 15 RPM free tier limit
        if (done < total) {
          await new Promise(resolve => setTimeout(resolve, 3500));
        }
      }

      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
      showConfirm('AI Enrichment Complete', `Successfully enriched all ${total} words!`, null, false);
    });
  });

  await reloadVaultList();
}

export async function reloadVaultList() {
  wordsList = await getWords();
  selectedWordIds.clear();
  renderList(wordsList, selectedWordIds, openModal, deleteWord);
}

function deleteWord(wordObj) {
  showConfirm('Delete Word', `Delete "${wordObj.word}" from your vault?`, async () => {
    wordsList = wordsList.filter(w => w.id !== wordObj.id);
    await saveWords(wordsList); await reloadVaultList();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  });
}
