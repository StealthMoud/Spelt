import { showConfirm } from './vault.js';
import { exportDb, importDb, wipeDb, importSyntaxDb } from './settings/actions.js';

let onDbRestoredCallback = null;

export function initSettings(onDbRestored) {
  onDbRestoredCallback = onDbRestored;

  chrome.storage?.local.get('spelt_target_lang', (res) => {
    const lang = res.spelt_target_lang || 'none';
    const selectEl = document.getElementById('setting-target-lang');
    if (selectEl) selectEl.value = lang;
  });

  document.getElementById('setting-target-lang')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_target_lang: e.target.value });
  });

  chrome.storage?.local.get('spelt_selection_lookup', (res) => {
    const enabled = res.spelt_selection_lookup !== false;
    const checkboxEl = document.getElementById('setting-selection-lookup');
    if (checkboxEl) checkboxEl.checked = enabled;
  });

  document.getElementById('setting-selection-lookup')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_selection_lookup: e.target.checked });
  });

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
  document.getElementById('import-db-trigger-btn').addEventListener('click', () => {
    showConfirm(
      'Import & Merge Library',
      'This will merge the chosen backup file into your existing library. Existing words will be updated with any new translations/examples, but their spacing and history will be preserved. No data will be wiped. Proceed?',
      () => fileInput.click()
    );
  });
  fileInput.addEventListener('change', (e) => importDb(e, onDbRestoredCallback));

  const syntaxFileInput = document.getElementById('import-syntax-file');
  document.getElementById('import-syntax-trigger-btn')?.addEventListener('click', () => {
    showConfirm(
      'Import Syntax Patterns',
      'This will merge syntax pattern structures into your library. Spacing and history for existing items will be preserved. No data will be wiped. Proceed?',
      () => syntaxFileInput.click()
    );
  });
  syntaxFileInput?.addEventListener('change', (e) => importSyntaxDb(e, onDbRestoredCallback));

  document.getElementById('wipe-db-btn').addEventListener('click', () => wipeDb(onDbRestoredCallback));

  document.getElementById('retranslate-all-btn')?.addEventListener('click', () => {
    showConfirm(
      'Refresh All Words',
      'This will query Google Translate and the dictionary in the background to refresh all translations and details. Proceed?',
      triggerRetranslate
    );
  });

  chrome.runtime.onMessage.addListener(async (message) => {
    if (message.action === 'retranslateCompleted') {
      showConfirm('Update Complete', `Successfully refreshed all ${message.count} words!`, null, false);
      if (onDbRestoredCallback) await onDbRestoredCallback();
    } else if (message.action === 'retranslateFailed') {
      showConfirm('Update Failed', `Error: ${message.error}`, null, false);
    }
  });
}

async function triggerRetranslate() {
  const selectEl = document.getElementById('setting-target-lang');
  const targetLang = selectEl ? selectEl.value : 'none';

  if (targetLang === 'none') {
    showConfirm('No Language Set', 'Please select a preferred language first.', null, false);
    return;
  }

  const btn = document.getElementById('retranslate-all-btn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Processing in background...';
  }

  chrome.runtime.sendMessage({ action: 'retranslateAll', targetLang }, () => {
    showConfirm('Started', 'Retranslation has been delegated to the background service worker.', null, false);
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Refresh All Translations & Details';
    }
  });
}
