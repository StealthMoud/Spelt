import { showConfirm } from './vault.js';
import { exportDb, importDb, wipeDb } from './settings/actions.js';

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

  // Load Gemini key, model and model list on startup
  chrome.storage?.local.get(['spelt_gemini_key', 'spelt_gemini_model', 'spelt_gemini_models_list'], (res) => {
    const key = res.spelt_gemini_key || '';
    const model = res.spelt_gemini_model || '';
    const modelsList = res.spelt_gemini_models_list || [];
    const keyInput = document.getElementById('setting-gemini-key');
    if (keyInput) keyInput.value = key;

    if (key && model) {
      const modelSelect = document.getElementById('setting-gemini-model');
      const modelContainer = document.getElementById('gemini-model-container');
      if (modelSelect && modelContainer) {
        modelSelect.innerHTML = '';
        if (modelsList.length > 0) {
          modelsList.forEach(mName => {
            const option = document.createElement('option');
            option.value = mName;
            option.textContent = mName.replace('models/', '');
            modelSelect.appendChild(option);
          });
        } else {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model.replace('models/', '');
          modelSelect.appendChild(option);
        }
        modelSelect.value = model;
        modelContainer.style.display = 'flex';
      }
    }
  });

  // Save Gemini Key on change
  document.getElementById('setting-gemini-key')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_gemini_key: e.target.value.trim() });
  });

  // Save Gemini Model on change
  document.getElementById('setting-gemini-model')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_gemini_model: e.target.value });
  });

  // Test Gemini Key and List Models
  document.getElementById('test-gemini-btn')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('setting-gemini-key');
    const statusEl = document.getElementById('gemini-test-status');
    const modelSelect = document.getElementById('setting-gemini-model');
    const modelContainer = document.getElementById('gemini-model-container');
    if (!keyInput || !statusEl || !modelSelect || !modelContainer) return;

    const key = keyInput.value.trim();
    if (!key) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Please enter an API Key first.';
      return;
    }

    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--primary-light)';
    statusEl.textContent = 'Fetching available models...';

    try {
      // 1. Fetch available models for this key
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
      if (!modelsRes.ok) {
        const errData = await modelsRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || 'Invalid API Key or API Error';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = `❌ Connection failed: ${errMsg}`;
        return;
      }

      const modelsData = await modelsRes.json();
      const availableModels = (modelsData.models || []).filter(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
      );

      if (availableModels.length === 0) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = '❌ No models supporting text generation found for this API Key.';
        return;
      }

      // Populate dropdown
      modelSelect.innerHTML = '';
      availableModels.forEach(m => {
        const option = document.createElement('option');
        option.value = m.name; // e.g. "models/gemini-1.5-flash"
        option.textContent = m.name.replace('models/', '') + (m.displayName ? ` (${m.displayName})` : '');
        modelSelect.appendChild(option);
      });

      // Select default model
      const stored = await new Promise(r => chrome.storage?.local.get('spelt_gemini_model', res => r(res.spelt_gemini_model)));
      let defaultModel = stored;
      if (!defaultModel || !availableModels.some(m => m.name === defaultModel)) {
        const preferred = [
          'models/gemini-3.5-flash',
          'models/gemini-3.1-flash-lite',
          'models/gemini-2.5-pro',
          'models/gemini-2.5-flash',
          'models/gemini-2.0-flash',
          'models/gemini-1.5-flash'
        ];
        const matched = preferred.find(p => availableModels.some(m => m.name === p));
        defaultModel = matched || availableModels[0].name;
      }
      modelSelect.value = defaultModel;
      modelContainer.style.display = 'flex';

      // 2. Perform test content generation with selected model to verify it works
      statusEl.textContent = `Testing content generation with ${defaultModel.replace('models/', '')}...`;
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1/${defaultModel}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Write the word "connected".' }] }]
        })
      });

      if (testRes.ok) {
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = `✅ Connected successfully! Model ${defaultModel.replace('models/', '')} is verified.`;
        
        const modelNames = availableModels.map(m => m.name);
        chrome.storage?.local.set({ 
          spelt_gemini_key: key, 
          spelt_gemini_model: defaultModel,
          spelt_gemini_models_list: modelNames
        });
      } else {
        const errData = await testRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || 'Verification request failed';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = `❌ Connected, but model verification failed: ${errMsg}`;
      }
    } catch (err) {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = `❌ Error: ${err.message}`;
    }
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
  document.getElementById('import-db-trigger-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => importDb(e, onDbRestoredCallback));

  document.getElementById('wipe-db-btn').addEventListener('click', () => wipeDb(onDbRestoredCallback));

  document.getElementById('retranslate-all-btn')?.addEventListener('click', () => {
    showConfirm(
      'Refresh All Words via AI',
      'This will query Gemini AI in the background to clean up, enrich, and optimize translations and details for all library words (processed sequentially to fit free rate limits). Proceed?',
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
