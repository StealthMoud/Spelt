// Compact database settings controller for Spelt extension popup
import { getWords, saveWords, resetDb } from '../../shared/storage.js';

let onDbRestoredCallback = null;

export function initSettings(onDbRestored) {
  onDbRestoredCallback = onDbRestored;

  // Spacing multiplier sync
  chrome.storage?.local.get('srs_multiplier', (res) => {
    const mult = res.srs_multiplier || '1.0';
    document.getElementById('setting-srs-multiplier').value = mult;
  });

  document.getElementById('setting-srs-multiplier').addEventListener('change', (e) => {
    chrome.storage?.local.set({ srs_multiplier: e.target.value });
  });

  document.getElementById('export-db-btn').addEventListener('click', exportDb);
  
  const fileInput = document.getElementById('import-db-file');
  document.getElementById('import-db-trigger-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importDb);

  document.getElementById('wipe-db-btn').addEventListener('click', wipeDb);
}

async function exportDb() {
  try {
    const words = await getWords();
    const dataStr = JSON.stringify(words, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spelt_library_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

async function importDb(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const words = JSON.parse(evt.target.result);
      if (!Array.isArray(words)) throw new Error('Invalid backup file');
      await saveWords(words);
      alert('Library restored successfully!');
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

async function wipeDb() {
  if (confirm('Are you sure you want to delete all words and activity data? This action cannot be undone.')) {
    await resetDb();
    alert('Database purged successfully!');
    if (onDbRestoredCallback) {
      await onDbRestoredCallback();
    }
  }
}
