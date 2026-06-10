import { getWords, addWord, saveWords } from '../../shared/storage.js';

let wordsList = [];
let onVaultUpdatedCallback = null;

export async function initVault(onVaultUpdated) {
  onVaultUpdatedCallback = onVaultUpdated;

  // Bind actions
  document.getElementById('add-word-trigger-btn').addEventListener('click', () => openFormModal());
  document.getElementById('form-modal-close').addEventListener('click', closeFormModal);
  document.getElementById('form-cancel-btn').addEventListener('click', closeFormModal);
  document.getElementById('word-entry-form').addEventListener('submit', saveWordForm);
  
  // Search and status filter inputs
  document.getElementById('vault-search').addEventListener('input', renderVaultList);
  document.getElementById('vault-filter-status').addEventListener('change', renderVaultList);

  await reloadVault();
}

export async function reloadVault() {
  wordsList = await getWords();
  renderVaultList();
}

// Populate table rows based on filters
function renderVaultList() {
  const query = document.getElementById('vault-search').value.trim().toLowerCase();
  const filter = document.getElementById('vault-filter-status').value;
  const tbody = document.getElementById('vault-list');
  const emptyState = document.getElementById('vault-empty-state');
  
  tbody.innerHTML = '';
  const now = Date.now();

  const filtered = wordsList.filter(w => {
    // Text search filter
    const matchesText = w.word.toLowerCase().includes(query) || 
                        w.definition.toLowerCase().includes(query) ||
                        w.translation.toLowerCase().includes(query);
    
    // Dropdown status filter
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

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    filtered.forEach(w => {
      const tr = document.createElement('tr');
      const nextStr = w.nextDate <= now ? 'Due Now' : new Date(w.nextDate).toLocaleDateString();
      
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--primary-light);">${w.word}</td>
        <td>${w.definition || '--'}</td>
        <td>${w.translation || '--'}</td>
        <td style="font-variant-numeric: tabular-nums;">${w.ef.toFixed(1)}</td>
        <td style="font-variant-numeric: tabular-nums;">${w.rep}</td>
        <td style="color: ${w.nextDate <= now ? 'var(--primary-light)' : 'var(--text-muted)'}">${nextStr}</td>
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

      // Event listeners for actions
      tr.querySelector('.edit-btn').addEventListener('click', () => openFormModal(w));
      tr.querySelector('.delete-btn').addEventListener('click', () => confirmDeleteWord(w));

      tbody.appendChild(tr);
    });
  }
}

function openFormModal(wordObj = null) {
  const modal = document.getElementById('word-form-modal');
  const title = document.getElementById('form-modal-title');
  
  // Clear inputs
  document.getElementById('edit-word-id').value = wordObj ? wordObj.id : '';
  document.getElementById('form-word').value = wordObj ? wordObj.word : '';
  document.getElementById('form-definition').value = wordObj ? wordObj.definition : '';
  document.getElementById('form-transcription').value = wordObj ? wordObj.transcription : '';
  document.getElementById('form-translation').value = wordObj ? wordObj.translation : '';
  document.getElementById('form-example').value = wordObj ? wordObj.example : '';
  document.getElementById('form-notes').value = wordObj ? wordObj.notes : '';

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
  const example = document.getElementById('form-example').value.trim();
  const notes = document.getElementById('form-notes').value.trim();

  try {
    if (id) {
      // Edit mode
      const idx = wordsList.findIndex(w => w.id === id);
      if (idx !== -1) {
        wordsList[idx] = { ...wordsList[idx], word, definition, transcription, translation, example, notes };
        await saveWords(wordsList);
      }
    } else {
      // Add mode
      await addWord({ word, definition, transcription, translation, example, notes });
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
