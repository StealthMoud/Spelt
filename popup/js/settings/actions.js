import { getWords, saveWords, resetDb } from '../../../shared/storage.js';
import { showConfirm } from '../vault.js';

export async function exportDb() {
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

export async function importDb(e, onDbRestoredCallback) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      let words;
      if (Array.isArray(parsed)) {
        words = parsed;
      } else if (parsed && Array.isArray(parsed.words)) {
        words = parsed.words;
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

export async function wipeDb(onDbRestoredCallback) {
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
