import { getWords, addWord, saveWords, translateWord } from '../../shared/storage.js';

let wordsList = [];
let onVaultUpdatedCallback = null;
let selectedWordIds = new Set();

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;

  // Bind actions
  document.getElementById('add-word-trigger-btn').addEventListener('click', () => openFormModal());
  document.getElementById('form-modal-close').addEventListener('click', closeFormModal);
  document.getElementById('form-cancel-btn').addEventListener('click', closeFormModal);
  document.getElementById('word-entry-form').addEventListener('submit', saveWordForm);

  document.getElementById('form-auto-fill-btn')?.addEventListener('click', async () => {
    const wordInput = document.getElementById('form-word');
    const word = wordInput?.value.trim();
    if (!word) return;

    const fillBtn = document.getElementById('form-auto-fill-btn');
    if (fillBtn) {
      fillBtn.disabled = true;
      fillBtn.style.opacity = '0.5';
    }

    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (response.ok) {
        const data = await response.json();
        const first = data[0];
        
        const def = first.meanings[0]?.definitions[0]?.definition || '';
        document.getElementById('form-definition').value = def;
        
        const ipa = first.phonetics.find(p => p.text)?.text || '';
        document.getElementById('form-transcription').value = ipa;
        
        const pos = first.meanings[0]?.partOfSpeech || '';
        document.getElementById('form-part-of-speech').value = pos;
        
        let example = '';
        if (first.meanings) {
          outerLoop: for (const m of first.meanings) {
            if (m.definitions) {
              for (const d of m.definitions) {
                if (d.example) {
                  example = d.example.trim();
                  break outerLoop;
                }
              }
            }
          }
        }
        document.getElementById('form-example').value = example;
      }

      // Trigger auto translate
      const translation = await translateWord(word);
      document.getElementById('form-translation').value = translation;

    } catch (err) {
      console.error('Auto fill error:', err);
    } finally {
      if (fillBtn) {
        fillBtn.disabled = false;
        fillBtn.style.opacity = '1';
      }
    }
  });

  document.getElementById('form-auto-translate-btn')?.addEventListener('click', async () => {
    const wordInput = document.getElementById('form-word');
    const transInput = document.getElementById('form-translation');
    const word = wordInput?.value.trim();
    if (!word) return;

    const translateBtn = document.getElementById('form-auto-translate-btn');
    if (translateBtn) {
      translateBtn.disabled = true;
      translateBtn.style.opacity = '0.5';
    }

    try {
      const translation = await translateWord(word);
      if (transInput) transInput.value = translation;
    } catch (err) {
      alert(err.message || 'Translation failed');
    } finally {
      if (translateBtn) {
        translateBtn.disabled = false;
        translateBtn.style.opacity = '1';
      }
    }
  });
  
  // Search and status filter inputs
  document.getElementById('vault-search').addEventListener('input', () => {
    selectedWordIds.clear();
    renderVaultList();
  });
  document.getElementById('vault-filter-status').addEventListener('change', () => {
    selectedWordIds.clear();
    renderVaultList();
  });

  // Sort controls
  document.getElementById('vault-sort-field')?.addEventListener('change', () => {
    selectedWordIds.clear();
    renderVaultList();
  });
  document.getElementById('vault-sort-dir-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('vault-sort-dir-btn');
    const current = btn.getAttribute('data-dir');
    const next = current === 'asc' ? 'desc' : 'asc';
    btn.setAttribute('data-dir', next);
    document.getElementById('sort-dir-label').textContent = next.toUpperCase();
    const icon = document.getElementById('sort-dir-icon');
    if (icon) icon.style.transform = next === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
    selectedWordIds.clear();
    renderVaultList();
  });

  // Bulk action listeners
  document.getElementById('vault-select-all')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const query = document.getElementById('vault-search').value.trim().toLowerCase();
    const filter = document.getElementById('vault-filter-status').value;
    const now = Date.now();
    
    let filtered = wordsList.filter(w => {
      const matchesText = w.word.toLowerCase().includes(query) || 
                          w.definition.toLowerCase().includes(query) ||
                          w.translation.toLowerCase().includes(query);
      let matchesStatus = true;
      if (filter === 'due') {
        matchesStatus = w.nextDate <= now;
      } else if (filter === 'new') {
        matchesStatus = w.rep === 0;
      } else if (filter === 'review') {
        matchesStatus = w.rep > 0;
      }
      return matchesText && matchesStatus;
    });

    if (checked) {
      filtered.forEach(w => selectedWordIds.add(w.id));
    } else {
      filtered.forEach(w => selectedWordIds.delete(w.id));
    }
    updateBulkUIState(filtered);
  });

  document.getElementById('vault-delete-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    
    const modal = document.getElementById('dashboard-confirm-modal');
    const msg = document.getElementById('confirm-modal-msg');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    msg.textContent = `Are you sure you want to delete all ${selectedWordIds.size} selected words from your vault?`;
    modal.classList.add('active');

    const cleanup = () => {
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    const close = () => {
      modal.classList.remove('active');
      cleanup();
    };
    
    const handleOk = async () => {
      wordsList = wordsList.filter(w => !selectedWordIds.has(w.id));
      await saveWords(wordsList);
      selectedWordIds.clear();
      close();
      await reloadVault();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    };

    const handleCancel = () => close();

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
  });

  await reloadVault();
}

export async function reloadVault() {
  wordsList = await getWords();
  selectedWordIds.clear();
  renderVaultList();
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

function renderVaultList() {
  const query = document.getElementById('vault-search').value.trim().toLowerCase();
  const filter = document.getElementById('vault-filter-status').value;
  const sortField = document.getElementById('vault-sort-field')?.value || 'alpha';
  const sortDir = document.getElementById('vault-sort-dir-btn')?.getAttribute('data-dir') || 'asc';
  const tbody = document.getElementById('vault-list');
  const emptyState = document.getElementById('vault-empty-state');
  
  tbody.innerHTML = '';
  const now = Date.now();

  let filtered = wordsList.filter(w => {
    const matchesText = w.word.toLowerCase().includes(query) || 
                        w.definition.toLowerCase().includes(query) ||
                        w.translation.toLowerCase().includes(query);
    
    let matchesStatus = true;
    if (filter === 'due') {
      matchesStatus = w.nextDate <= now;
    } else if (filter === 'new') {
      matchesStatus = w.rep === 0;
    } else if (filter === 'review') {
      matchesStatus = w.rep > 0;
    }

    return matchesText && matchesStatus;
  });

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
    emptyState.style.display = 'block';
    updateBulkUIState([]);
  } else {
    emptyState.style.display = 'none';
    filtered.forEach(w => {
      const tr = document.createElement('tr');
      const review = formatTimeUntil(w.nextDate);
      const isChecked = selectedWordIds.has(w.id) ? 'checked' : '';
      
      tr.innerHTML = `
        <td style="padding-left: 12px; vertical-align: middle;">
          <input type="checkbox" class="word-select-checkbox" data-id="${w.id}" ${isChecked} style="accent-color: var(--primary); cursor: pointer; width: 14px; height: 14px; margin: 0; vertical-align: middle;">
        </td>
        <td style="font-weight: 600; color: var(--primary-light);">${w.word}</td>
        <td>${w.definition || '--'}</td>
        <td>${w.translation || '--'}</td>
        <td style="color: var(--danger); font-style: italic; font-size: 0.8rem;">${w.misspellings && w.misspellings.length > 0 ? w.misspellings.join(', ') : '--'}</td>
        <td style="font-variant-numeric: tabular-nums;">${w.ef.toFixed(1)}</td>
        <td style="font-variant-numeric: tabular-nums;">${w.rep}</td>
        <td style="color: ${review.color}; font-variant-numeric: tabular-nums;">${review.text}</td>
        <td style="text-align: right;">
          <div class="word-action-cell">
            <button class="table-icon-btn edit-btn" data-id="${w.id}" title="Edit word">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="table-icon-btn table-delete-btn delete-btn" data-id="${w.id}" title="Delete word">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.word-select-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedWordIds.add(w.id);
        } else {
          selectedWordIds.delete(w.id);
        }
        updateBulkUIState(filtered);
      });
      tr.querySelector('.edit-btn').addEventListener('click', () => openFormModal(w));
      tr.querySelector('.delete-btn').addEventListener('click', () => confirmDeleteWord(w));

      tbody.appendChild(tr);
    });
    updateBulkUIState(filtered);
  }
}

function updateBulkUIState(filtered) {
  const deleteBtn = document.getElementById('vault-delete-selected');
  const selectAllCheckbox = document.getElementById('vault-select-all');
  const selectedCountSpan = document.getElementById('vault-selected-count');

  if (!deleteBtn || !selectAllCheckbox) return;

  if (filtered.length === 0) {
    deleteBtn.style.display = 'none';
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  const filteredSelected = filtered.filter(w => selectedWordIds.has(w.id));
  
  if (filteredSelected.length > 0) {
    deleteBtn.style.display = 'inline-flex';
    selectedCountSpan.textContent = filteredSelected.length;
  } else {
    deleteBtn.style.display = 'none';
  }

  if (filteredSelected.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (filteredSelected.length === filtered.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }

  // Update check states of visible elements
  document.querySelectorAll('.word-select-checkbox').forEach(cb => {
    const id = cb.getAttribute('data-id');
    cb.checked = selectedWordIds.has(id);
  });
}

export function openFormModal(wordObj = null) {
  const modal = document.getElementById('word-form-modal');
  const title = document.getElementById('form-modal-title');
  
  document.getElementById('edit-word-id').value = wordObj ? wordObj.id : '';
  document.getElementById('form-word').value = wordObj ? wordObj.word : '';
  document.getElementById('form-definition').value = wordObj ? wordObj.definition : '';
  document.getElementById('form-transcription').value = wordObj ? wordObj.transcription : '';
  document.getElementById('form-translation').value = wordObj ? wordObj.translation : '';
  document.getElementById('form-part-of-speech').value = wordObj ? (wordObj.partOfSpeech || '') : '';
  document.getElementById('form-example').value = wordObj ? (wordObj.example || '') : '';
  document.getElementById('form-notes').value = wordObj ? wordObj.notes : '';

  const pastContainer = document.getElementById('form-past-errors-container');
  const pastList = document.getElementById('form-past-errors-list');
  if (pastContainer && pastList) {
    if (wordObj && wordObj.misspellings && wordObj.misspellings.length > 0) {
      pastList.textContent = wordObj.misspellings.join(', ');
      pastContainer.style.display = 'block';
    } else {
      pastContainer.style.display = 'none';
    }
  }

  title.textContent = wordObj ? 'Edit Word Details' : 'Add New Word';
  modal.classList.add('active');
  document.getElementById('form-word').focus();
}

function closeFormModal() {
  document.getElementById('word-form-modal').classList.remove('active');
}

async function saveWordForm(e) {
  e.preventDefault();
  const id = document.getElementById('edit-word-id').value;
  const word = document.getElementById('form-word').value.trim();
  const definition = document.getElementById('form-definition').value.trim();
  const transcription = document.getElementById('form-transcription').value.trim();
  const translation = document.getElementById('form-translation').value.trim();
  const partOfSpeech = document.getElementById('form-part-of-speech').value.trim();
  const example = document.getElementById('form-example').value.trim();
  const notes = document.getElementById('form-notes').value.trim();

  try {
    if (id) {
      const idx = wordsList.findIndex(w => w.id === id);
      if (idx !== -1) {
        wordsList[idx] = { ...wordsList[idx], word, definition, transcription, translation, partOfSpeech, example, notes };
        await saveWords(wordsList);
      }
    } else {
      await addWord({ word, definition, transcription, translation, partOfSpeech, example, notes });
    }
    closeFormModal();
    await reloadVault();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  } catch (err) {
    alert(err.message || 'Operation failed');
  }
}

function confirmDeleteWord(wordObj) {
  const modal = document.getElementById('dashboard-confirm-modal');
  const msg = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  msg.textContent = `Are you sure you want to delete the word "${wordObj.word}" from your vault?`;
  modal.classList.add('active');

  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const close = () => {
    modal.classList.remove('active');
    cleanup();
  };
  
  const handleOk = async () => {
    wordsList = wordsList.filter(w => w.id !== wordObj.id);
    await saveWords(wordsList);
    close();
    await reloadVault();
    if (onVaultUpdatedCallback) onVaultUpdatedCallback();
  };

  const handleCancel = () => close();

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
}
