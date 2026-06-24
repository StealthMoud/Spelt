// Compact database settings controller for Spelt extension popup
import { getWords, saveWords, resetDb, fetchTranslation } from '../../shared/storage.js';
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

  // Selection lookup sync
  chrome.storage?.local.get('spelt_selection_lookup', (res) => {
    const enabled = res.spelt_selection_lookup !== false;
    const checkboxEl = document.getElementById('setting-selection-lookup');
    if (checkboxEl) checkboxEl.checked = enabled;
  });

  document.getElementById('setting-selection-lookup')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_selection_lookup: e.target.checked });
  });

  // Keep setting values synchronized in real-time
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.spelt_target_lang) {
        const el = document.getElementById('setting-target-lang');
        if (el) el.value = changes.spelt_target_lang.newValue || 'none';
      }
      if (changes.spelt_selection_lookup) {
        const el = document.getElementById('setting-selection-lookup');
        if (el) el.checked = changes.spelt_selection_lookup.newValue !== false;
      }
    }
  });

  document.getElementById('export-db-btn').addEventListener('click', exportDb);
  
  const fileInput = document.getElementById('import-db-file');
  document.getElementById('import-db-trigger-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', importDb);

  document.getElementById('wipe-db-btn').addEventListener('click', wipeDb);

  document.getElementById('retranslate-all-btn')?.addEventListener('click', () => {
    showConfirm(
      'Refresh All Words',
      'This will query Google Translate and the dictionary in the background to refresh all translations and details. You can close the popup once started. Proceed?',
      triggerRetranslate
    );
  });

  // Listen for background translation tasks finished
  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'retranslateCompleted') {
      showConfirm('Update Complete', `Successfully refreshed translations and details for all ${message.count} words!`, null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    } else if (message.action === 'retranslateFailed') {
      showConfirm('Update Failed', `Error during background update: ${message.error}`, null, false);
    }
  });
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

async function triggerRetranslate() {
  const selectEl = document.getElementById('setting-target-lang');
  const targetLang = selectEl ? selectEl.value : 'none';

  if (targetLang === 'none') {
    showConfirm('No Language Set', 'Please select a preferred language first in Settings.', null, false);
    return;
  }

  const btn = document.getElementById('retranslate-all-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Processing in background...';
  }

  chrome.runtime.sendMessage({ action: 'retranslateAll', targetLang }, (response) => {
    showConfirm(
      'Background Task Started',
      'Retranslation has been delegated to the background service worker. You can safely close the popup or keep using the app.',
      null,
      false
    );
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Refresh All Translations & Details';
    }
  });
}
