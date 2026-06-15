// Compact word vault list and modal controller for Spelt extension popup
import { getWords, addWord, saveWords } from '../../shared/storage.js';

let wordsList = [];
let onVaultUpdatedCallback = null;
let selectedWordIds = new Set();

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;

  document.getElementById('add-word-btn').addEventListener('click', () => openModal());
  document.getElementById('form-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('word-entry-form').addEventListener('submit', saveWord);
  
  // Search inputs
  document.getElementById('vault-search').addEventListener('input', () => {
    selectedWordIds.clear();
    renderList();
  });

  // Sort controls
  document.getElementById('vault-sort-field')?.addEventListener('change', () => {
    selectedWordIds.clear();
    renderList();
  });
  
  document.getElementById('vault-sort-dir-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('vault-sort-dir-btn');
    const current = btn.getAttribute('data-dir');
    const next = current === 'asc' ? 'desc' : 'asc';
    btn.setAttribute('data-dir', next);
    document.getElementById('sort-dir-label').textContent = next.toUpperCase();
    selectedWordIds.clear();
    renderList();
  });

  // Bulk actions
  document.getElementById('vault-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const query = document.getElementById('vault-search').value.trim().toLowerCase();
    const filtered = wordsList.filter(w => 
      w.word.toLowerCase().includes(query) || 
      w.definition.toLowerCase().includes(query)
    );
    
    if (checked) {
      filtered.forEach(w => selectedWordIds.add(w.id));
    } else {
      filtered.forEach(w => selectedWordIds.delete(w.id));
    }
    updateBulkUIState(filtered);
  });

  document.getElementById('vault-delete-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm(
      'Delete Selected',
      `Delete all ${selectedWordIds.size} selected words from your vault?`,
      async () => {
        wordsList = wordsList.filter(w => !selectedWordIds.has(w.id));
        await saveWords(wordsList);
        selectedWordIds.clear();
        await reloadVaultList();
        if (onVaultUpdatedCallback) onVaultUpdatedCallback();
      }
    );
  });

  await reloadVaultList();
}

export async function reloadVaultList() {
  wordsList = await getWords();
  selectedWordIds.clear();
  renderList();
}

function formatTimeUntil(nextDate) {
  const now = Date.now();
  if (nextDate <= now) return { text: 'Due now', color: 'var(--primary-light)' };
  const diff = nextDate - now;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return { text: `in ${mins}m`, color: 'var(--warning, hsl(40,90%,55%))' };
  if (hrs < 24) return { text: `in ${hrs}h`, color: 'var(--text-muted)' };
  if (days < 30) return { text: `in ${days}d`, color: 'var(--text-muted)' };
  const months = Math.floor(days / 30);
  return { text: `in ${months}mo`, color: 'var(--text-muted)' };
}

function renderList() {
  const query = document.getElementById('vault-search').value.trim().toLowerCase();
  const listEl = document.getElementById('popup-vault-list');
  const emptyEl = document.getElementById('vault-list-empty');
  const sortField = document.getElementById('vault-sort-field')?.value || 'alpha';
  const sortDir = document.getElementById('vault-sort-dir-btn')?.getAttribute('data-dir') || 'asc';

  listEl.innerHTML = '';
  
  let filtered = wordsList.filter(w => 
    w.word.toLowerCase().includes(query) || 
    w.definition.toLowerCase().includes(query)
  );

  // Apply sorting
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'alpha') {
      cmp = a.word.localeCompare(b.word, undefined, { sensitivity: 'base' });
    } else if (sortField === 'date') {
      cmp = (a.createdAt || 0) - (b.createdAt || 0);
    } else if (sortField === 'review') {
      cmp = (a.nextDate || 0) - (b.nextDate || 0);
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
    updateBulkUIState([]);
  } else {
    emptyEl.style.display = 'none';
    filtered.forEach(w => {
      const li = document.createElement('li');
      li.className = 'vault-list-item';
      const review = formatTimeUntil(w.nextDate);
      const isChecked = selectedWordIds.has(w.id) ? 'checked' : '';
      
      li.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <input type="checkbox" class="word-select-checkbox" data-id="${w.id}" ${isChecked} style="accent-color: var(--primary); cursor: pointer; width: 13px; height: 13px; margin: 0; flex-shrink: 0;">
          <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <strong style="color: var(--primary-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${w.word}</strong>
              <span style="font-size: 0.58rem; color: ${review.color}; background: hsla(0,0%,100%,0.04); padding: 1px 5px; border-radius: 4px; white-space: nowrap; flex-shrink: 0;">${review.text}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${w.definition || 'No definition'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 4px; margin-left: 8px;">
          <button class="table-icon-btn edit-btn" data-id="${w.id}" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg></button>
          <button class="table-icon-btn delete-btn" data-id="${w.id}" style="background: none; border: none; cursor: pointer; color: var(--danger); padding: 4px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      `;
      
      li.querySelector('.word-select-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedWordIds.add(w.id);
        } else {
          selectedWordIds.delete(w.id);
        }
        updateBulkUIState(filtered);
      });
      li.querySelector('.edit-btn').addEventListener('click', () => openModal(w));
      li.querySelector('.delete-btn').addEventListener('click', () => deleteWord(w));
      listEl.appendChild(li);
    });
    updateBulkUIState(filtered);
  }
}

function updateBulkUIState(filtered) {
  const bulkRow = document.getElementById('vault-bulk-row');
  const selectAllCheckbox = document.getElementById('vault-select-all');
  const selectedCountSpan = document.getElementById('vault-selected-count');
  const deleteBtn = document.getElementById('vault-delete-selected');

  if (!bulkRow) return;

  if (filtered.length === 0) {
    bulkRow.style.display = 'none';
    return;
  }

  bulkRow.style.display = 'flex';
  
  const filteredSelected = filtered.filter(w => selectedWordIds.has(w.id));
  selectedCountSpan.textContent = filteredSelected.length;

  if (filteredSelected.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    deleteBtn.disabled = true;
    deleteBtn.style.opacity = '0.5';
    deleteBtn.style.cursor = 'not-allowed';
  } else if (filteredSelected.length === filtered.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    deleteBtn.disabled = false;
    deleteBtn.style.opacity = '1';
    deleteBtn.style.cursor = 'pointer';
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
    deleteBtn.disabled = false;
    deleteBtn.style.opacity = '1';
    deleteBtn.style.cursor = 'pointer';
  }

  // Update DOM checkbox checked states
  document.querySelectorAll('.word-select-checkbox').forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.checked = selectedWordIds.has(id);
  });
}

export function openModal(wordObj = null) {
  const modal = document.getElementById('word-form-modal');
  document.getElementById('edit-word-id').value = wordObj ? wordObj.id : '';
  document.getElementById('form-word').value = wordObj ? wordObj.word : '';
  document.getElementById('form-definition').value = wordObj ? wordObj.definition : '';
  document.getElementById('form-transcription').value = wordObj ? wordObj.transcription : '';
  document.getElementById('form-translation').value = wordObj ? wordObj.translation : '';
  document.getElementById('form-example').value = wordObj ? wordObj.example : '';
  document.getElementById('form-modal-title').textContent = wordObj ? 'Edit Word Details' : 'Add New Word';
  modal.style.display = 'flex';
  document.getElementById('form-word').focus();
}

function closeModal() {
  document.getElementById('word-form-modal').style.display = 'none';
}

async function saveWord(e) {
  e.preventDefault();
  const id = document.getElementById('edit-word-id').value;
  const word = document.getElementById('form-word').value.trim();
  const definition = document.getElementById('form-definition').value.trim();
  const transcription = document.getElementById('form-transcription').value.trim();
  const translation = document.getElementById('form-translation').value.trim();
  const example = document.getElementById('form-example').value.trim();

  try {
    if (id) {
      const idx = wordsList.findIndex(w => w.id === id);
      if (idx !== -1) {
        wordsList[idx] = { ...wordsList[idx], word, definition, transcription, translation, example };
        await saveWords(wordsList);
      }
    } else {
      await addWord({ word, definition, transcription, translation, example });
    }
    closeModal();
    await reloadVaultList();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  } catch (err) {
    showConfirm('Error', err.message || 'Save failed', null, false);
  }
}

function deleteWord(wordObj) {
  showConfirm(
    'Delete Word',
    `Delete "${wordObj.word}" from your vault?`,
    async () => {
      wordsList = wordsList.filter(w => w.id !== wordObj.id);
      await saveWords(wordsList);
      await reloadVaultList();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    }
  );
}

export function showConfirm(title, message, onOk, showCancel = true) {
  const modal = document.getElementById('popup-confirm-modal');
  const titleEl = document.getElementById('popup-confirm-title');
  const msgEl = document.getElementById('popup-confirm-msg');
  const okBtn = document.getElementById('popup-confirm-ok-btn');
  const cancelBtn = document.getElementById('popup-confirm-cancel-btn');

  titleEl.textContent = title;
  msgEl.textContent = message;
  cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';
  modal.style.display = 'flex';

  const close = () => {
    modal.style.display = 'none';
    cleanup();
  };

  const handleOk = async () => {
    if (onOk) await onOk();
    close();
  };

  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', close);
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', close);
}
