export function confirm(title, message, onOk, expectedConfirmText = null) {
  return showConfirm(title, message, onOk, true, expectedConfirmText);
}

export function progress(title, message) {
  return showConfirm(title, message, null, false);
}

export function notify(title, message, onOk = null) {
  return showConfirm(title, message, onOk, false);
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
  cancelBtn.classList.toggle('hidden', !showCancel);

  if (expectedConfirmText) {
    inputLabel.textContent = `Type "${expectedConfirmText}" to confirm:`;
    inputField.value = '';
    inputContainer.classList.remove('hidden');
    okBtn.disabled = true;
  } else {
    inputContainer.classList.add('hidden');
    okBtn.disabled = false;
  }

  modal.classList.remove('hidden');
  if (typeof modal.showModal === 'function' && !modal.open) {
    modal.showModal();
  }
  if (expectedConfirmText) {
    inputField.focus();
  }

  const handleInput = () => {
    const match = inputField.value.trim() === expectedConfirmText;
    okBtn.disabled = !match;
  };

  const handlePaste = (e) => e.preventDefault();
  const handlePreventCopy = (e) => e.preventDefault();

  if (expectedConfirmText) {
    inputField.addEventListener('input', handleInput);
    inputField.addEventListener('paste', handlePaste);
    inputLabel.addEventListener('copy', handlePreventCopy);
    inputLabel.addEventListener('selectstart', handlePreventCopy);
  }

  const close = () => {
    modal.classList.add('hidden');
    if (typeof modal.close === 'function' && modal.open) {
      modal.close();
    }
    cleanup();
  };

  const handleDialogCancel = (event) => {
    event.preventDefault();
    close();
  };

  const handleEscape = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  };

  const handleOk = async () => {
    if (expectedConfirmText && inputField.value.trim() !== expectedConfirmText) {
      return;
    }
    close();
    if (onOk) await onOk();
  };

  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', close);
    modal.removeEventListener('cancel', handleDialogCancel);
    modal.removeEventListener('keydown', handleEscape);
    if (expectedConfirmText) {
      inputField.removeEventListener('input', handleInput);
      inputField.removeEventListener('paste', handlePaste);
      inputLabel.removeEventListener('copy', handlePreventCopy);
      inputLabel.removeEventListener('selectstart', handlePreventCopy);
    }
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('cancel', handleDialogCancel);
  modal.addEventListener('keydown', handleEscape);
}

export function showImportOptionsModal(onSelect, onCancel) {
  const modal = document.getElementById('popup-import-options-modal');
  const btnBoth = document.getElementById('import-option-both');
  const btnSpelling = document.getElementById('import-option-spelling');
  const btnRecall = document.getElementById('import-option-recall');
  const btnCancel = document.getElementById('import-option-cancel');

  modal.classList.remove('hidden');
  if (typeof modal.showModal === 'function' && !modal.open) {
    modal.showModal();
  }

  const close = () => {
    modal.classList.add('hidden');
    if (typeof modal.close === 'function' && modal.open) {
      modal.close();
    }
    cleanup();
  };

  const handleBoth = () => {
    onSelect('both');
    close();
  };

  const handleSpelling = () => {
    onSelect('spelling');
    close();
  };

  const handleRecall = () => {
    onSelect('recall');
    close();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    close();
  };

  const handleDialogCancel = (event) => {
    event.preventDefault();
    handleCancel();
  };

  const handleEscape = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    handleCancel();
  };

  const cleanup = () => {
    btnBoth.removeEventListener('click', handleBoth);
    btnSpelling.removeEventListener('click', handleSpelling);
    btnRecall.removeEventListener('click', handleRecall);
    btnCancel.removeEventListener('click', handleCancel);
    modal.removeEventListener('cancel', handleDialogCancel);
    modal.removeEventListener('keydown', handleEscape);
  };

  btnBoth.addEventListener('click', handleBoth);
  btnSpelling.addEventListener('click', handleSpelling);
  btnRecall.addEventListener('click', handleRecall);
  btnCancel.addEventListener('click', handleCancel);
  modal.addEventListener('cancel', handleDialogCancel);
  modal.addEventListener('keydown', handleEscape);
}
