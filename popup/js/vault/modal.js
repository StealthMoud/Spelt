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
  document.getElementById('form-practice-type').value = wordObj ? (wordObj.practiceType || 'both') : 'both';
  document.getElementById('form-mastered').checked = wordObj ? (wordObj.mastered || false) : false;
  
  currentFormMisspellings = wordObj && wordObj.misspellings ? [...wordObj.misspellings] : [];
  renderPastErrorsList();

  document.getElementById('form-modal-title').textContent = wordObj ? 'Edit Word Details' : 'Add New Word';
  
  const practiceTypeSelect = document.getElementById('form-practice-type');
  const ptVal = practiceTypeSelect.value;
  updateFormLabels(ptVal);

  // Update custom select UI for Practice Target
  const wrapper = practiceTypeSelect.closest('.custom-select-wrapper');
  if (wrapper) {
    const options = wrapper.querySelectorAll('.custom-option');
    options.forEach(o => o.classList.remove('selected'));
    const selectedOpt = wrapper.querySelector(`.custom-option[data-value="${ptVal}"]`);
    if (selectedOpt) {
      selectedOpt.classList.add('selected');
      wrapper.querySelector('.custom-select-trigger span').textContent = selectedOpt.textContent;
    }
  }
  
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

function updateFormLabels(practiceType) {
  const wordLabel = document.querySelector('label[for="form-word"]') || document.querySelector('#form-word').parentElement.previousElementSibling;
  const defLabel = document.querySelector('label[for="form-definition"]') || document.querySelector('#form-definition').previousElementSibling;
  const exLabel = document.querySelector('label[for="form-example"]') || document.querySelector('#form-example').previousElementSibling;
  
  const wordInput = document.getElementById('form-word');
  const posInput = document.getElementById('form-part-of-speech');

  if (practiceType === 'syntax') {
    if (wordLabel) wordLabel.textContent = 'Pattern Name *';
    if (defLabel) defLabel.textContent = 'Pattern Rule / Explanation *';
    if (exLabel) exLabel.textContent = 'Target Sentence (will be scrambled)';
    if (!posInput.value) posInput.value = 'Grammatical Pattern';
  } else {
    if (wordLabel) wordLabel.textContent = 'Word *';
    if (defLabel) defLabel.textContent = 'Definition *';
    if (exLabel) exLabel.textContent = 'Example Sentence';
  }
}

// Add event listener to update labels dynamically when user changes dropdown
const ptSelect = document.getElementById('form-practice-type');
if (ptSelect) {
  ptSelect.addEventListener('change', (e) => {
    updateFormLabels(e.target.value);
  });
}
