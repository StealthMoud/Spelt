import { formatTimeUntil, getFilteredWords } from './filter.js';

export function updateBulkUIState(filtered, selectedWordIds) {
  const bulkRow = document.getElementById('vault-bulk-row');
  const selectAllCheckbox = document.getElementById('vault-select-all');
  const selectedCountSpan = document.getElementById('vault-selected-count');
  const deleteBtn = document.getElementById('vault-delete-selected');
  const demasterBtn = document.getElementById('vault-demaster-selected');
  const enrichBtn = document.getElementById('vault-enrich-selected');

  if (!bulkRow) return;
  const filteredSelected = filtered.filter(w => selectedWordIds.has(w.id));
  const hasSelection = filteredSelected.length > 0;

  if (!hasSelection) {
    bulkRow.classList.add('hidden');
    return;
  }
  bulkRow.classList.remove('hidden');
  selectedCountSpan.textContent = filteredSelected.length;

  const isAll = filteredSelected.length === filtered.length;
  selectAllCheckbox.checked = isAll;
  selectAllCheckbox.indeterminate = !isAll;
  
  [deleteBtn, demasterBtn, enrichBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = false;
  });

  document.querySelectorAll('.word-select-checkbox').forEach(cb => {
    cb.checked = selectedWordIds.has(cb.getAttribute('data-id'));
  });
}

export function renderList(wordsList, selectedWordIds, openModalCallback, deleteWordCallback) {
  const listEl = document.getElementById('popup-vault-list');
  const emptyEl = document.getElementById('vault-list-empty');
  const sortField = document.getElementById('vault-sort-field')?.value || 'alpha';
  const sortDir = document.getElementById('vault-sort-dir-btn')?.getAttribute('data-dir') || 'asc';

  listEl.replaceChildren();
  let filtered = getFilteredWords(wordsList);

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'alpha') cmp = a.word.localeCompare(b.word, undefined, { sensitivity: 'base' });
    else if (sortField === 'date') cmp = (a.createdAt || 0) - (b.createdAt || 0);
    else if (sortField === 'review') cmp = (a.nextDate || 0) - (b.nextDate || 0);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  if (filtered.length === 0) {
    emptyEl.classList.remove('hidden');
    updateBulkUIState([], selectedWordIds);
    return;
  }
  
  emptyEl.classList.add('hidden');

  const fragment = document.createDocumentFragment();

  filtered.forEach(w => {
    const li = document.createElement('li');
    li.className = 'vault-list-item';

    const mainCol = document.createElement('div');
    mainCol.className = 'vault-item-main';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'word-select-checkbox';
    checkbox.setAttribute('data-id', w.id);
    checkbox.checked = selectedWordIds.has(w.id);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) selectedWordIds.add(w.id);
      else selectedWordIds.delete(w.id);
      updateBulkUIState(filtered, selectedWordIds);
    });

    const infoCol = document.createElement('div');
    infoCol.className = 'vault-item-info';

    const wordRow = document.createElement('div');
    wordRow.className = 'vault-item-word-row';

    const wordStrong = document.createElement('strong');
    wordStrong.className = 'vault-item-word';
    wordStrong.textContent = w.word;

    const review = formatTimeUntil(w);
    const reviewPill = document.createElement('span');
    reviewPill.className = 'review-pill';
    reviewPill.textContent = review.text;

    // State chip
    const stateChip = document.createElement('span');
    if (w.mastered) {
      stateChip.className = 'vault-chip chip-mastered';
      stateChip.textContent = 'Mastered';
    } else if (review.text === 'Due now') {
      stateChip.className = 'vault-chip chip-due';
      stateChip.textContent = 'Due';
    } else {
      stateChip.className = 'vault-chip chip-active';
      stateChip.textContent = 'Active';
    }

    wordRow.appendChild(wordStrong);
    wordRow.appendChild(stateChip);
    wordRow.appendChild(reviewPill);

    const defSpan = document.createElement('span');
    defSpan.className = 'vault-item-def';
    defSpan.textContent = w.definition || 'No definition';

    infoCol.appendChild(wordRow);
    infoCol.appendChild(defSpan);

    const uniqueErrors = w.misspellings ? [...new Set(w.misspellings.filter(Boolean))] : [];
    if (uniqueErrors.length > 0) {
      const errSpan = document.createElement('span');
      errSpan.className = 'error-tag';
      errSpan.textContent = `${uniqueErrors.length} error${uniqueErrors.length > 1 ? 's' : ''}`;
      infoCol.appendChild(errSpan);
    }

    mainCol.appendChild(checkbox);
    mainCol.appendChild(infoCol);

    const actionCol = document.createElement('div');
    actionCol.className = 'vault-item-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn edit-btn';
    editBtn.setAttribute('data-id', w.id);
    editBtn.title = 'Edit word';
    editBtn.setAttribute('aria-label', `Edit ${w.word}`);
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>`;
    editBtn.addEventListener('click', () => openModalCallback(w));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'icon-btn delete-btn';
    deleteBtn.setAttribute('data-id', w.id);
    deleteBtn.title = 'Delete word';
    deleteBtn.setAttribute('aria-label', `Delete ${w.word}`);
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg-sm"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    deleteBtn.addEventListener('click', () => deleteWordCallback(w));

    actionCol.appendChild(editBtn);
    actionCol.appendChild(deleteBtn);

    li.appendChild(mainCol);
    li.appendChild(actionCol);
    fragment.appendChild(li);
  });

  listEl.appendChild(fragment);
  updateBulkUIState(filtered, selectedWordIds);
}
