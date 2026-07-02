import { formatTimeUntil, getFilteredWords } from './filter.js';

export function updateBulkUIState(filtered, selectedWordIds) {
  const bulkRow = document.getElementById('vault-bulk-row');
  const selectAllCheckbox = document.getElementById('vault-select-all');
  const selectedCountSpan = document.getElementById('vault-selected-count');
  const deleteBtn = document.getElementById('vault-delete-selected');
  const demasterBtn = document.getElementById('vault-demaster-selected');
  const enrichBtn = document.getElementById('vault-enrich-selected');

  if (!bulkRow) return;
  if (filtered.length === 0) {
    bulkRow.style.display = 'none';
    return;
  }
  bulkRow.style.display = 'flex';
  
  const filteredSelected = filtered.filter(w => selectedWordIds.has(w.id));
  selectedCountSpan.textContent = filteredSelected.length;

  const hasSelection = filteredSelected.length > 0;
  const isAll = hasSelection && filteredSelected.length === filtered.length;
  
  selectAllCheckbox.checked = isAll;
  selectAllCheckbox.indeterminate = hasSelection && !isAll;
  [deleteBtn, demasterBtn, enrichBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = !hasSelection;
    btn.style.opacity = hasSelection ? '1' : '0.5';
    btn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
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

  listEl.innerHTML = '';
  let filtered = getFilteredWords(wordsList);

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'alpha') cmp = a.word.localeCompare(b.word, undefined, { sensitivity: 'base' });
    else if (sortField === 'date') cmp = (a.createdAt || 0) - (b.createdAt || 0);
    else if (sortField === 'review') cmp = (a.nextDate || 0) - (b.nextDate || 0);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
    updateBulkUIState([], selectedWordIds);
    return;
  }
  
  emptyEl.style.display = 'none';
  filtered.forEach(w => {
    const li = document.createElement('li');
    li.className = 'vault-list-item';
    const review = formatTimeUntil(w);
    const isChecked = selectedWordIds.has(w.id) ? 'checked' : '';
    const errText = w.misspellings && w.misspellings.filter(Boolean).length > 0 
      ? `<span class="error-tag">Errors: ${[...new Set(w.misspellings.filter(Boolean))].join(', ')}</span>` : '';
    
    li.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
        <input type="checkbox" class="word-select-checkbox" data-id="${w.id}" ${isChecked}>
        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <strong style="color: var(--primary-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.88rem;">${w.word}</strong>
            <span class="review-pill" style="color: ${review.color}; border-color: ${review.color}25; background: ${review.color}10;">${review.text}</span>
          </div>
          <span style="color: var(--text-muted); font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">${w.definition || 'No definition'}</span>
          ${errText}
        </div>
      </div>
      <div style="display: flex; gap: 6px; margin-left: 8px;">
        <button class="table-icon-btn edit-btn" data-id="${w.id}" title="Edit word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg></button>
        <button class="table-icon-btn delete-btn" data-id="${w.id}" title="Delete word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;
    
    li.querySelector('.word-select-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) selectedWordIds.add(w.id);
      else selectedWordIds.delete(w.id);
      updateBulkUIState(filtered, selectedWordIds);
    });
    li.querySelector('.edit-btn').addEventListener('click', () => openModalCallback(w));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteWordCallback(w));
    listEl.appendChild(li);
  });
  updateBulkUIState(filtered, selectedWordIds);
}
