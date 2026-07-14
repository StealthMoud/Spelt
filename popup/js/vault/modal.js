export let currentFormMisspellings = [];
let currentFormWordObj = null;

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
  
  currentFormWordObj = wordObj;
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
  const statsEl = document.getElementById('form-past-errors-stats');
  const correctWord = document.getElementById('form-word')?.value.trim() || '';

  if (pastContainer && pastList) {
    const validErrors = currentFormMisspellings.filter(Boolean);
    if (validErrors.length > 0) {
      // Count frequency of each misspelling
      const counts = {};
      validErrors.forEach(err => {
        counts[err] = (counts[err] || 0) + 1;
      });

      // Simple Levenshtein function
      const getDistance = (a, b) => {
        const al = a.toLowerCase();
        const bl = b.toLowerCase();
        const r = Array(bl.length + 1).fill(0).map((_, i) => [i]);
        for (let j = 0; j <= al.length; j++) r[0][j] = j;
        for (let i = 1; i <= bl.length; i++) {
          for (let j = 1; j <= al.length; j++) {
            r[i][j] = bl.charAt(i - 1) === al.charAt(j - 1) 
              ? r[i - 1][j - 1] 
              : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
          }
        }
        return r[bl.length][al.length];
      };

      // Unique misspellings
      const uniqueErrors = [...new Set(validErrors)];

      pastList.innerHTML = uniqueErrors.map(err => {
        const count = counts[err];
        const dist = correctWord ? getDistance(err, correctWord) : 0;
        const distText = dist > 0 ? `${dist} ${dist === 1 ? 'edit' : 'edits'} away` : '';
        const countBadge = count > 1 ? `<span style="font-size: 0.58rem; background: hsla(5, 85%, 55%, 0.18); color: var(--danger); padding: 1px 4px; border-radius: 3px; font-weight: 700; margin-left: 4px;">${count}x</span>` : '';
        const badgeText = distText || countBadge ? `(${distText}${distText && countBadge ? ', ' : ''}${countBadge})` : '';

        return `
          <div class="error-trash-chip" data-error="${err}" style="display: flex; align-items: center; justify-content: space-between; width: 100%; box-sizing: border-box; background: hsla(5, 80%, 15%, 0.12); border: 1px solid hsla(5, 80%, 35%, 0.2); padding: 5px 8px; font-size: 0.72rem; color: var(--text-main); border-radius: var(--radius-sm); cursor: default; transition: all var(--transition-fast) ease;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: var(--danger);">${err}</span>
              ${badgeText ? `<span style="font-size: 0.62rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 2px;">${distText} ${countBadge}</span>` : ''}
            </div>
            <button type="button" class="delete-error-x" title="Remove error from log">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 8px; height: 8px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }).join('');

      // Render stats
      if (statsEl) {
        const uniqueCount = uniqueErrors.length;
        let statsStr = `${uniqueCount} unique error${uniqueCount > 1 ? 's' : ''}`;
        if (currentFormWordObj) {
          const streak = currentFormWordObj.correctStreak || 0;
          statsStr += ` · Streak: ${streak}`;
        }
        statsEl.textContent = statsStr;
      }

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
  
  const pronContainer = document.getElementById('form-pronunciation-container');
  const posContainer = document.getElementById('form-pos-container');
  const autoBtn = document.getElementById('form-auto-fill-btn');

  if (wordLabel) wordLabel.textContent = 'Word *';
  if (defLabel) defLabel.textContent = 'Definition *';
  if (exLabel) exLabel.textContent = 'Example Sentence';
  if (pronContainer) pronContainer.style.display = 'block';
  if (posContainer) posContainer.style.display = 'block';
  if (autoBtn) autoBtn.style.display = 'flex';
}

// Add event listener to update labels dynamically when user changes dropdown
const ptSelect = document.getElementById('form-practice-type');
if (ptSelect) {
  ptSelect.addEventListener('change', (e) => {
    updateFormLabels(e.target.value);
  });
}
