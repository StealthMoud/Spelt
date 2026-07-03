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

  const handlePaste = (e) => e.preventDefault();
  const handlePreventCopy = (e) => e.preventDefault();

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

export function showImportOptionsModal(onSelect, onCancel) {
  const modal = document.getElementById('popup-import-options-modal');
  const btnBoth = document.getElementById('import-option-both');
  const btnSpelling = document.getElementById('import-option-spelling');
  const btnRecall = document.getElementById('import-option-recall');
  const btnSyntax = document.getElementById('import-option-syntax');
  const btnCancel = document.getElementById('import-option-cancel');

  modal.style.display = 'flex';

  const close = () => {
    modal.style.display = 'none';
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

  const handleSyntax = () => {
    onSelect('syntax');
    close();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    close();
  };

  const cleanup = () => {
    btnBoth.removeEventListener('click', handleBoth);
    btnSpelling.removeEventListener('click', handleSpelling);
    btnRecall.removeEventListener('click', handleRecall);
    if (btnSyntax) btnSyntax.removeEventListener('click', handleSyntax);
    btnCancel.removeEventListener('click', handleCancel);
  };

  btnBoth.addEventListener('click', handleBoth);
  btnSpelling.addEventListener('click', handleSpelling);
  btnRecall.addEventListener('click', handleRecall);
  if (btnSyntax) btnSyntax.addEventListener('click', handleSyntax);
  btnCancel.addEventListener('click', handleCancel);
}
