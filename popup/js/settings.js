// Compact database settings controller for Spelt extension popup
import { getWords, saveWords, resetDb } from '../../shared/storage.js';
import { showConfirm } from './vault.js';

let onDbRestoredCallback = null;

export function initSettings(onDbRestored) {
  onDbRestoredCallback = onDbRestored;

  // Target language sync
  chrome.storage?.local.get('spelt_target_lang', (res) => {
    const lang = res.spelt_target_lang || 'none';
    const selectEl = document.getElementById('setting-target-lang');
    if (selectEl) selectEl.value = lang;
  });

  document.getElementById('setting-target-lang')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_target_lang: e.target.value });
  });

  // Keep setting values synchronized in real-time
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.spelt_target_lang) {
        const el = document.getElementById('setting-target-lang');
        if (el) el.value = changes.spelt_target_lang.newValue || 'none';
      }
    }
  });

  document.getElementById('export-db-btn').addEventListener('click', exportDb);
  
  const fileInput = document.getElementById('import-db-file');
  document.getElementById('import-db-trigger-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importDb);

  document.getElementById('wipe-db-btn').addEventListener('click', wipeDb);
}

async function exportDb() {
  showConfirm(
    'Export Database',
    'Do you want to download a backup of your Spelt library?',
    async () => {
      try {
        const words = await getWords();
        let activity = {}, streak = { current: 0, lastDate: '' };
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const res = await chrome.storage.local.get(['spelt_activity', 'spelt_streak']);
          activity = res.spelt_activity || {};
          streak = res.spelt_streak || { current: 0, lastDate: '' };
        }
        const dataPackage = { words, activity, streak, exportDate: Date.now() };
        const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spelt_library_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        showConfirm('Export Error', 'Export failed: ' + e.message, null, false);
      }
    }
  );
}

async function importDb(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      // Support both old bare-array format and new structured format
      let words;
      if (Array.isArray(parsed)) {
        words = parsed;
      } else if (parsed && Array.isArray(parsed.words)) {
        words = parsed.words;
        // Restore activity and streak if present
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          if (parsed.activity) await chrome.storage.local.set({ 'spelt_activity': parsed.activity });
          if (parsed.streak) await chrome.storage.local.set({ 'spelt_streak': parsed.streak });
        }
      } else {
        throw new Error('Invalid backup file');
      }
      await saveWords(words);
      showConfirm('Success', 'Library restored successfully!', null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    } catch (err) {
      showConfirm('Import Error', 'Import failed: ' + err.message, null, false);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function wipeDb() {
  const captcha = Math.random().toString(36).substring(2, 8).toUpperCase();
  showConfirm(
    'Wipe Database',
    'Are you sure you want to delete all words and activity data? This action cannot be undone.',
    async () => {
      await resetDb();
      showConfirm('Purged', 'Database purged successfully!', null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    },
    true,
    captcha
  );
}
