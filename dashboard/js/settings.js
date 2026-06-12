import { getWords, saveWords, resetDb } from '../../shared/storage.js';

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let onDbRestoredCallback = null;

export function initSettings(onDbRestored) {
  onDbRestoredCallback = onDbRestored;

  document.getElementById('wipe-db-btn')?.addEventListener('click', () => {
    showConfirm(
      'Wipe Database',
      'WARNING: This will permanently erase ALL vocabulary words and practice logs. Are you sure you want to proceed?',
      async () => {
        await resetDb();
        showConfirm('Purged', 'Database purged successfully.', null, false);
        if (onDbRestoredCallback) await onDbRestoredCallback();
      }
    );
  });

  document.getElementById('export-db-btn')?.addEventListener('click', () => {
    showConfirm(
      'Export Database',
      'Do you want to download a backup of your Spelt library?',
      async () => {
        try {
          const words = await getWords();
          let activity = {}, streak = { current: 0, lastDate: '' };
          if (isExt) {
            const res = await chrome.storage.local.get(['spelt_activity', 'spelt_streak']);
            activity = res.spelt_activity || {};
            streak = res.spelt_streak || { current: 0, lastDate: '' };
          }
          const dataPackage = { words, activity, streak, exportDate: Date.now() };
          const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `spelt-backup-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          showConfirm('Export Error', 'Export failed: ' + err.message, null, false);
        }
      }
    );
  });

  const importInput = document.getElementById('import-db-file');
  document.getElementById('import-db-trigger-btn')?.addEventListener('click', () => importInput.click());
  importInput?.addEventListener('change', handleImport);

  const multiplierSelect = document.getElementById('setting-srs-multiplier');
  multiplierSelect?.addEventListener('change', saveMultiplierSetting);
  loadMultiplierSetting();

  const targetLangSelect = document.getElementById('setting-target-lang');
  targetLangSelect?.addEventListener('change', saveTargetLangSetting);
  loadTargetLangSetting();

  if (isExt) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.spelt_target_lang) {
          const el = document.getElementById('setting-target-lang');
          if (el) el.value = changes.spelt_target_lang.newValue || 'none';
        }
        if (changes.spelt_srs_multiplier) {
          const el = document.getElementById('setting-srs-multiplier');
          if (el) el.value = (changes.spelt_srs_multiplier.newValue || 1.0).toString();
        }
      }
    });
  }
}

async function saveMultiplierSetting() {
  const mult = parseFloat(document.getElementById('setting-srs-multiplier').value);
  if (isExt) {
    await chrome.storage.local.set({ 'spelt_srs_multiplier': mult });
  } else {
    localStorage.setItem('spelt_srs_multiplier', mult.toString());
  }
}

async function loadMultiplierSetting() {
  let val = 1.0;
  if (isExt) {
    const res = await chrome.storage.local.get('spelt_srs_multiplier');
    val = res.spelt_srs_multiplier || 1.0;
  } else {
    const stored = localStorage.getItem('spelt_srs_multiplier');
    if (stored) val = parseFloat(stored);
  }
  const selectEl = document.getElementById('setting-srs-multiplier');
  if (selectEl) selectEl.value = val.toString();
}

async function saveTargetLangSetting() {
  const lang = document.getElementById('setting-target-lang').value;
  if (isExt) {
    await chrome.storage.local.set({ 'spelt_target_lang': lang });
  } else {
    localStorage.setItem('spelt_target_lang', lang);
  }
}

async function loadTargetLangSetting() {
  let val = 'none';
  if (isExt) {
    const res = await chrome.storage.local.get('spelt_target_lang');
    val = res.spelt_target_lang || 'none';
  } else {
    val = localStorage.getItem('spelt_target_lang') || 'none';
  }
  const selectEl = document.getElementById('setting-target-lang');
  if (selectEl) selectEl.value = val;
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed || !Array.isArray(parsed.words)) {
        throw new Error('Invalid backup file layout (missing words list)');
      }
      await saveWords(parsed.words);
      if (isExt) {
        if (parsed.activity) await chrome.storage.local.set({ 'spelt_activity': parsed.activity });
        if (parsed.streak) await chrome.storage.local.set({ 'spelt_streak': parsed.streak });
      }
      showConfirm('Success', 'Database successfully restored!', null, false);
      if (onDbRestoredCallback) await onDbRestoredCallback();
    } catch (err) {
      showConfirm('Import Error', 'Import failed: ' + err.message, null, false);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function showConfirm(title, message, onOk, showCancel = true) {
  const modal = document.getElementById('dashboard-confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  if (titleEl) titleEl.textContent = title;
  msgEl.textContent = message;
  cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';
  modal.classList.add('active');

  const close = () => {
    modal.classList.remove('active');
    cleanup();
  };

  const handleOk = async () => {
    if (onOk) await onOk();
    close();
  };

  const cleanup = () => {
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', close);
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', close);
}
