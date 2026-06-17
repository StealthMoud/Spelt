// Compact word vault list and modal controller for Spelt extension popup
import { getWords, addWord, saveWords, translateWord, fetchCambridgePronunciation, playWordAudio } from '../../shared/storage.js';

let wordsList = [];
let onVaultUpdatedCallback = null;
let selectedWordIds = new Set();

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;

  document.getElementById('add-word-btn').addEventListener('click', () => openModal());
  document.getElementById('form-cancel-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });
  document.getElementById('word-entry-form').addEventListener('submit', saveWord);

  document.getElementById('form-play-uk')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (word) {
      playWordAudio(word, 'uk').catch(err => console.error(err));
    }
  });

  document.getElementById('form-play-us')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (word) {
      playWordAudio(word, 'us').catch(err => console.error(err));
    }
  });

  document.getElementById('form-auto-fill-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
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
        
        let ipa = '';
        try {
          const cambridge = await fetchCambridgePronunciation(word);
          if (cambridge.ukIpa && cambridge.usIpa) {
            ipa = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
          } else {
            ipa = cambridge.ukIpa || cambridge.usIpa || '';
          }
        } catch (_) {}
        if (!ipa) {
          ipa = first.phonetics.find(p => p.text)?.text || '';
        }
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

  document.getElementById('form-auto-translate-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
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
  
  // Search inputs
  document.getElementById('vault-search').addEventListener('input', () => {
    selectedWordIds.clear();
    renderList();
  });

  // Filter control
  document.getElementById('vault-filter-status')?.addEventListener('change', () => {
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
    const filtered = getFilteredWords();
    
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

  document.getElementById('vault-demaster-selected')?.addEventListener('click', () => {
    if (selectedWordIds.size === 0) return;
    showConfirm(
      'Re-study Selected',
      `Move all ${selectedWordIds.size} selected words back into your practice cycle?`,
      async () => {
        wordsList.forEach(w => {
          if (selectedWordIds.has(w.id)) {
            w.mastered = false;
            w.rep = 0;
            w.interval = 1;
            w.nextDate = Date.now();
          }
        });
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

function formatTimeUntil(w) {
  if (w.mastered) {
    return { text: 'Mastered', color: 'var(--success)' };
  }
  const nextDate = w.nextDate;
  const now = Date.now();
  if (nextDate <= now) return { text: 'Due now', color: 'var(--primary-light)' };
  const diff = nextDate - now;
  const mins = Math.round(diff / 60000);
  const hrs = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (mins < 60) return { text: `in ${mins}m`, color: 'var(--warning, hsl(40,90%,55%))' };
  if (hrs < 24) return { text: `in ${hrs}h`, color: 'var(--text-muted)' };
  if (days < 30) return { text: `in ${days}d`, color: 'var(--text-muted)' };
  const months = Math.round(days / 30);
  return { text: `in ${months}mo`, color: 'var(--text-muted)' };
}

function getFilteredWords() {
  const query = document.getElementById('vault-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('vault-filter-status')?.value || 'all';

  let filtered = wordsList.filter(w => 
    w.word.toLowerCase().includes(query) || 
    w.definition.toLowerCase().includes(query)
  );

  if (statusFilter === 'learning') {
    filtered = filtered.filter(w => !w.mastered);
  } else if (statusFilter === 'mastered') {
    filtered = filtered.filter(w => w.mastered);
  } else if (statusFilter === 'due') {
    filtered = filtered.filter(w => w.nextDate <= Date.now() && !w.mastered);
  }

  return filtered;
}

function renderList() {
  const listEl = document.getElementById('popup-vault-list');
  const emptyEl = document.getElementById('vault-list-empty');
  const sortField = document.getElementById('vault-sort-field')?.value || 'alpha';
  const sortDir = document.getElementById('vault-sort-dir-btn')?.getAttribute('data-dir') || 'asc';

  listEl.innerHTML = '';
  
  let filtered = getFilteredWords();

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
      const review = formatTimeUntil(w);
      const isChecked = selectedWordIds.has(w.id) ? 'checked' : '';
      
      li.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          <input type="checkbox" class="word-select-checkbox" data-id="${w.id}" ${isChecked}>
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <strong style="color: var(--primary-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;">${w.word}</strong>
              <span class="review-pill" style="color: ${review.color}; border-color: ${review.color}25; background: ${review.color}10;">${review.text}</span>
            </div>
            <span style="color: var(--text-muted); font-size: 0.68rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">${w.definition || 'No definition'}</span>
            ${w.misspellings && w.misspellings.filter(Boolean).length > 0 ? `<span class="error-tag">Errors: ${[...new Set(w.misspellings.filter(Boolean))].join(', ')}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-left: 8px;">
          <button class="table-icon-btn edit-btn" data-id="${w.id}" title="Edit word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg></button>
          <button class="table-icon-btn delete-btn" data-id="${w.id}" title="Delete word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
  const demasterBtn = document.getElementById('vault-demaster-selected');

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
    if (demasterBtn) {
      demasterBtn.disabled = true;
      demasterBtn.style.opacity = '0.5';
      demasterBtn.style.cursor = 'not-allowed';
    }
  } else {
    const isAll = filteredSelected.length === filtered.length;
    selectAllCheckbox.checked = isAll;
    selectAllCheckbox.indeterminate = !isAll;
    deleteBtn.disabled = false;
    deleteBtn.style.opacity = '1';
    deleteBtn.style.cursor = 'pointer';
    if (demasterBtn) {
      demasterBtn.disabled = false;
      demasterBtn.style.opacity = '1';
      demasterBtn.style.cursor = 'pointer';
    }
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
  document.getElementById('form-part-of-speech').value = wordObj ? (wordObj.partOfSpeech || '') : '';
  document.getElementById('form-example').value = wordObj ? (wordObj.example || '') : '';
  document.getElementById('form-mastered').checked = wordObj ? (wordObj.mastered || false) : false;
  
  const pastContainer = document.getElementById('form-past-errors-container');
  const pastList = document.getElementById('form-past-errors-list');
  if (pastContainer && pastList) {
    const validErrors = wordObj && wordObj.misspellings ? wordObj.misspellings.filter(Boolean) : [];
    if (validErrors.length > 0) {
      pastList.textContent = [...new Set(validErrors)].join(', ');
      pastContainer.style.display = 'block';
    } else {
      pastContainer.style.display = 'none';
    }
  }

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
  const partOfSpeech = document.getElementById('form-part-of-speech').value.trim();
  const example = document.getElementById('form-example').value.trim();
  const mastered = document.getElementById('form-mastered').checked;

  try {
    if (id) {
      const idx = wordsList.findIndex(w => w.id === id);
      if (idx !== -1) {
        const wasMastered = wordsList[idx].mastered;
        wordsList[idx] = { ...wordsList[idx], word, definition, transcription, translation, partOfSpeech, example, mastered };
        if (mastered && !wasMastered) {
          wordsList[idx].rep = 0;
          wordsList[idx].interval = 30;
          wordsList[idx].nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
        } else if (!mastered && wasMastered) {
          wordsList[idx].mastered = false;
          wordsList[idx].rep = 0;
          wordsList[idx].interval = 1;
          wordsList[idx].nextDate = Date.now();
        }
        await saveWords(wordsList);
      }
    } else {
      const addedWord = await addWord({ word, definition, transcription, translation, partOfSpeech, example, mastered });
      if (mastered) {
        const list = await getWords();
        const wObj = list.find(w => w.id === addedWord.id);
        if (wObj) {
          wObj.interval = 30;
          wObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
          await saveWords(list);
        }
      }
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

export function showConfirm(title, message, onOk, showCancel = true, expectedConfirmText = null) {
  const modal = document.getElementById('popup-confirm-modal');
  const titleEl = document.getElementById('popup-confirm-title');
  const msgEl = document.getElementById('popup-confirm-msg');
  const okBtn = document.getElementById('popup-confirm-ok-btn');
  const cancelBtn = document.getElementById('popup-confirm-cancel-btn');
  
  const inputContainer = document.getElementById('popup-confirm-input-container');
  const inputLabel = document.getElementById('popup-confirm-input-label');
  const inputField = document.getElementById('popup-confirm-input');

  titleEl.textContent = title;
  msgEl.textContent = message;
  cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';

  // Handle confirmation text validation if requested
  if (expectedConfirmText) {
    inputLabel.textContent = `Type "${expectedConfirmText}" to confirm:`;
    inputField.value = '';
    inputContainer.style.display = 'block';
    okBtn.disabled = true;
    okBtn.style.opacity = '0.5';
    okBtn.style.cursor = 'not-allowed';
  } else {
    inputContainer.style.display = 'none';
    okBtn.disabled = false;
    okBtn.style.opacity = '1';
    okBtn.style.cursor = 'pointer';
  }

  modal.style.display = 'flex';
  if (expectedConfirmText) {
    inputField.focus();
  }

  const handleInput = () => {
    const match = inputField.value.trim() === expectedConfirmText;
    okBtn.disabled = !match;
    okBtn.style.opacity = match ? '1' : '0.5';
    okBtn.style.cursor = match ? 'pointer' : 'not-allowed';
  };

  const handlePaste = (e) => {
    e.preventDefault();
  };

  const handlePreventCopy = (e) => {
    e.preventDefault();
  };

  if (expectedConfirmText) {
    inputField.addEventListener('input', handleInput);
    inputField.addEventListener('paste', handlePaste);
    inputLabel.addEventListener('copy', handlePreventCopy);
    inputLabel.addEventListener('selectstart', handlePreventCopy);
  }

  const close = () => {
    modal.style.display = 'none';
    cleanup();
  };

  const handleOk = async () => {
    if (expectedConfirmText && inputField.value.trim() !== expectedConfirmText) {
      return;
    }
    if (onOk) await onOk();
    close();
  };

  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', close);
    if (expectedConfirmText) {
      inputField.removeEventListener('input', handleInput);
      inputField.removeEventListener('paste', handlePaste);
      inputLabel.removeEventListener('copy', handlePreventCopy);
      inputLabel.removeEventListener('selectstart', handlePreventCopy);
    }
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', close);
}
