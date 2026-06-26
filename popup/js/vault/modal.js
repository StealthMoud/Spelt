export let currentFormMisspellings = [];

export function getCurrentFormMisspellings() {
  return currentFormMisspellings;
}

export function setCurrentFormMisspellings(val) {
  currentFormMisspellings = val;
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
  document.getElementById('form-level').value = wordObj ? (wordObj.level || '').toUpperCase().trim() : '';
  document.getElementById('form-mastered').checked = wordObj ? (wordObj.mastered || false) : false;
  
  currentFormMisspellings = wordObj && wordObj.misspellings ? [...wordObj.misspellings] : [];
  renderPastErrorsList();

  document.getElementById('form-modal-title').textContent = wordObj ? 'Edit Word Details' : 'Add New Word';
  modal.style.display = 'flex';
  document.getElementById('form-word').focus();
}

export function closeModal() {
  document.getElementById('word-form-modal').style.display = 'none';
}

export function renderPastErrorsList() {
  const pastContainer = document.getElementById('form-past-errors-container');
  const pastList = document.getElementById('form-past-errors-list');
  if (pastContainer && pastList) {
    const validErrors = currentFormMisspellings.filter(Boolean);
    if (validErrors.length > 0) {
      pastList.innerHTML = [...new Set(validErrors)].map(err => `
        <span class="error-trash-chip" data-error="${err}">
          <span>${err}</span>
          <span class="delete-error-x">&times;</span>
        </span>
      `).join('');
      pastContainer.style.display = 'block';
    } else {
      pastList.innerHTML = '';
      pastContainer.style.display = 'none';
    }
  }
}
