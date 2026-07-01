import { getWords, saveWords } from '../../shared/storage.js';
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
