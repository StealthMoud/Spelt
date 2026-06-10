import { getWords, saveWords, resetDb } from '../../shared/storage.js';

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export function initSettings(onDbRestored) {
  // Bind database wipe
  document.getElementById('wipe-db-btn').addEventListener('click', () => confirmWipe(onDbRestored));

  // Bind database export
  document.getElementById('export-db-btn').addEventListener('click', exportDatabase);

  // Bind database import triggers
  const importInput = document.getElementById('import-db-file');
  const importTrigger = document.getElementById('import-db-trigger-btn');
  
  importTrigger.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => handleImport(e, onDbRestored));

  // Spacing multiplier settings selector
  const multiplierSelect = document.getElementById('setting-srs-multiplier');
  multiplierSelect.addEventListener('change', saveMultiplierSetting);
  loadMultiplierSetting();

  // OAuth client ID settings save
  const oauthInput = document.getElementById('setting-oauth-client-id');
  const oauthSaveBtn = document.getElementById('save-oauth-client-id-btn');
  if (oauthSaveBtn && oauthInput) {
    oauthSaveBtn.addEventListener('click', saveOAuthClientId);
    loadOAuthClientId();
  }
}

async function saveMultiplierSetting() {
  const mult = document.getElementById('setting-srs-multiplier').value;
  if (isExt) {
    await chrome.storage.local.set({ 'spelt_srs_multiplier': parseFloat(mult) });
  }
}

async function loadMultiplierSetting() {
  if (isExt) {
    const res = await chrome.storage.local.get('spelt_srs_multiplier');
    const val = res['spelt_srs_multiplier'] || 1.0;
    document.getElementById('setting-srs-multiplier').value = val.toString();
  }
}

async function exportDatabase() {
  try {
    const words = await getWords();
    let activity = {};
    let streak = { current: 0, lastDate: '' };

    if (isExt) {
      const res = await chrome.storage.local.get(['spelt_activity', 'spelt_streak']);
      activity = res['spelt_activity'] || {};
      streak = res['spelt_streak'] || { current: 0, lastDate: '' };
    }

    const dataPackage = { words, activity, streak, exportDate: Date.now() };
    const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `spelt-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export spelt database:', err);
    alert('Export failed: ' + err.message);
  }
}

function handleImport(e, onDbRestored) {
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

      alert('Database successfully restored!');
      if (onDbRestored) await onDbRestored();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // clear input
}

function confirmWipe(onDbRestored) {
  const modal = document.getElementById('dashboard-confirm-modal');
  const msg = document.getElementById('confirm-modal-msg');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  msg.textContent = 'WARNING: This will permanently erase ALL vocabulary words and practice logs. Are you sure you want to proceed?';
  modal.classList.add('active');

  const close = () => modal.classList.remove('active');
  
  const handleWipe = async () => {
    await resetDb();
    close();
    alert('Database purged successfully.');
    if (onDbRestored) await onDbRestored();
    cleanup();
  };

  const cleanup = () => {
    okBtn.removeEventListener('click', handleWipe);
    cancelBtn.removeEventListener('click', close);
  };

  okBtn.addEventListener('click', handleWipe);
  cancelBtn.addEventListener('click', close);
}

async function saveOAuthClientId() {
  const val = document.getElementById('setting-oauth-client-id').value.trim();
  if (isExt) {
    await chrome.storage.local.set({ 'spelt_oauth_client_id': val });
    alert('OAuth Client ID saved successfully!');
  }
}

async function loadOAuthClientId() {
  if (isExt) {
    const res = await chrome.storage.local.get('spelt_oauth_client_id');
    const val = res['spelt_oauth_client_id'] || '';
    const input = document.getElementById('setting-oauth-client-id');
    if (input) input.value = val;
  }
}
