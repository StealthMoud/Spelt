import { getWords, getStored, isGeminiConfigured, askGemini, atomicUpdate } from '../../shared/storage.js';
import { getLanguageName } from '../../src/core/languages.js';
import { buildEnrichmentPrompt } from '../../shared/ai/prompts.js';
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
    saveWord(e, currentFormMisspellings, reloadVaultList, onVaultUpdatedCallback)
  );

  document.getElementById('form-past-errors-list')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-error-x');
    if (deleteBtn) {
      const chip = deleteBtn.closest('.error-trash-chip');
      if (chip) {
        setCurrentFormMisspellings(currentFormMisspellings.filter(x => x !== chip.getAttribute('data-error')));
        renderPastErrorsList();
      }
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
      await atomicUpdate(async (freshList) => {
        // Remove selected words in-place by splicing from end to start
        for (let i = freshList.length - 1; i >= 0; i--) {
          if (selectedWordIds.has(freshList[i].id)) freshList.splice(i, 1);
        }
      });
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-demaster-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm('Re-study Selected', `Move all ${selectedWordIds.size} selected words back into practice?`, async () => {
      await atomicUpdate(async (freshList) => {
        freshList.forEach(w => {
          if (selectedWordIds.has(w.id)) {
            w.mastered = false; w.rep = 0; w.interval = 1; w.nextDate = Date.now();
          }
        });
      });
      selectedWordIds.clear();
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    });
  });

  document.getElementById('vault-enrich-selected')?.addEventListener('click', async () => {
    if (selectedWordIds.size === 0) return;
    
    const isConfigured = await isGeminiConfigured();
    if (!isConfigured) {
      showConfirm('API Key Required', 'Please configure your Gemini API Key in the Settings tab.', null, false);
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
      const targetLangName = getLanguageName(targetLang);

      let done = 0;
      for (const id of idsToEnrich) {
        try {
          const list = await getWords();
          const w = list.find(x => x.id === id);
          if (w) {
            const prompt = buildEnrichmentPrompt(w.word, w, targetLangName);
            const aiData = await askGemini(prompt);
            
            // Use atomicUpdate to prevent concurrent editing issues
            await atomicUpdate(async (freshList) => {
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
              }
            });
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
  const existingIds = new Set(wordsList.map(w => w.id));
  for (const id of selectedWordIds) {
    if (!existingIds.has(id)) {
      selectedWordIds.delete(id);
    }
  }
  renderList(wordsList, selectedWordIds, openModal, deleteWord);
}

function deleteWord(wordObj) {
  showConfirm('Delete Word', `Delete "${wordObj.word}" from your vault?`, async () => {
    await atomicUpdate(async (freshList) => {
      const idx = freshList.findIndex(w => w.id === wordObj.id);
      if (idx !== -1) freshList.splice(idx, 1);
    });
    await reloadVaultList();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  });
}
