import { showConfirm } from './vault.js';
import { exportDb, importDb, wipeDb } from './settings/actions.js';
import { getAiStatus } from '../../shared/storage.js';

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

  chrome.storage?.local.get('spelt_allow_background_ai', (res) => {
    const enabled = !!res.spelt_allow_background_ai;
    const checkboxEl = document.getElementById('setting-allow-background-ai');
    if (checkboxEl) checkboxEl.checked = enabled;
  });

  document.getElementById('setting-allow-background-ai')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_allow_background_ai: e.target.checked });
  });

  // Load Gemini keys, model and model list on startup
  chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key', 'spelt_gemini_model', 'spelt_gemini_models_list'], (res) => {
    let keys = res.spelt_gemini_keys || [];
    if (keys.length === 0 && res.spelt_gemini_key) {
      keys = [res.spelt_gemini_key];
      chrome.storage?.local.set({ spelt_gemini_keys: keys }); // migrate to array
    }

    renderKeysList(keys);

    const model = res.spelt_gemini_model || '';
    const modelsList = res.spelt_gemini_models_list || [];
    const modelSelect = document.getElementById('setting-gemini-model');
    const modelContainer = document.getElementById('gemini-model-container');

    if (keys.length > 0 && modelSelect && modelContainer) {
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
        option.value = model || 'models/gemini-2.5-flash';
        option.textContent = (model || 'models/gemini-2.5-flash').replace('models/', '');
        modelSelect.appendChild(option);
      }
      modelSelect.value = model || 'models/gemini-2.5-flash';
      modelContainer.style.display = 'flex';
    } else if (modelContainer) {
      modelContainer.style.display = 'none';
    }
  });

  // Save Gemini Model on change
  document.getElementById('setting-gemini-model')?.addEventListener('change', (e) => {
    chrome.storage?.local.set({ spelt_gemini_model: e.target.value }, () => {
      renderAiStatusMonitor();
    });
  });

  // Add Gemini Key
  document.getElementById('add-gemini-key-btn')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('setting-gemini-key-input');
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
    statusEl.textContent = 'Verifying API key...';

    try {
      // Validate key by fetching models list
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
      if (!modelsRes.ok) {
        const errData = await modelsRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || 'Invalid API Key or API Error';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = `❌ Verification failed: ${errMsg}`;
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

      // Find matched preferred model to test content generation
      const preferredList = [
        'models/gemini-3.5-flash',
        'models/gemini-3.1-flash-lite',
        'models/gemini-2.5-pro',
        'models/gemini-2.5-flash',
        'models/gemini-2.0-flash',
        'models/gemini-1.5-flash'
      ];
      const testModel = preferredList.find(p => availableModels.some(m => m.name === p)) || availableModels[0].name;

      statusEl.textContent = `Testing content generation with ${testModel.replace('models/', '')}...`;
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1/${testModel}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Write the word "connected".' }] }]
        })
      });

      if (testRes.ok) {
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = `✅ API Key verified and added successfully!`;
        keyInput.value = ''; // clear input

        chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key', 'spelt_gemini_model', 'spelt_gemini_models_list'], (res) => {
          let keys = res.spelt_gemini_keys || [];
          if (keys.length === 0 && res.spelt_gemini_key) {
            keys = [res.spelt_gemini_key];
          }
          if (!keys.includes(key)) {
            keys.push(key);
          }

          const currentModel = res.spelt_gemini_model || testModel;
          const currentModelsList = res.spelt_gemini_models_list || [];
          
          // Merge models list
          const updatedModelsList = [...currentModelsList];
          availableModels.forEach(m => {
            if (!updatedModelsList.includes(m.name)) {
              updatedModelsList.push(m.name);
            }
          });

          chrome.storage?.local.set({
            spelt_gemini_keys: keys,
            spelt_gemini_key: keys[0] || '', // legacy fallback
            spelt_gemini_model: currentModel,
            spelt_gemini_models_list: updatedModelsList
          }, () => {
            // Refresh dropdown
            modelSelect.innerHTML = '';
            updatedModelsList.forEach(mName => {
              const option = document.createElement('option');
              option.value = mName;
              option.textContent = mName.replace('models/', '');
              modelSelect.appendChild(option);
            });
            modelSelect.value = currentModel;
            modelContainer.style.display = 'flex';

            renderKeysList(keys);
            renderAiStatusMonitor();
          });
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

  function renderKeysList(keys) {
    const listContainer = document.getElementById('gemini-keys-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    if (keys.length === 0) {
      listContainer.innerHTML = '<p style="font-size: 0.65rem; color: var(--text-muted); margin: 4px 0;">No API keys added yet.</p>';
      return;
    }

    keys.forEach(key => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.background = 'rgba(255, 255, 255, 0.03)';
      row.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      row.style.padding = '5px 8px';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.fontSize = '0.68rem';

      const maskedKey = key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-6)}` : key;
      row.innerHTML = `
        <span style="font-family: monospace; color: var(--text-muted);">${maskedKey}</span>
        <button class="remove-key-btn" style="background: none; border: none; color: var(--danger); font-size: 0.85rem; cursor: pointer; padding: 2px 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: opacity 0.2s;" title="Remove Key">×</button>
      `;

      row.querySelector('.remove-key-btn').addEventListener('click', () => {
        removeKey(key);
      });
      listContainer.appendChild(row);
    });
  }

  function removeKey(keyToRemove) {
    chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key'], (res) => {
      let keys = res.spelt_gemini_keys || [];
      if (keys.length === 0 && res.spelt_gemini_key) {
        keys = [res.spelt_gemini_key];
      }
      const updatedKeys = keys.filter(k => k !== keyToRemove);
      
      const updates = { spelt_gemini_keys: updatedKeys };
      if (res.spelt_gemini_key === keyToRemove) {
        updates.spelt_gemini_key = updatedKeys[0] || '';
      }

      chrome.storage?.local.set(updates, () => {
        renderKeysList(updatedKeys);
        const modelSelect = document.getElementById('setting-gemini-model');
        const modelContainer = document.getElementById('gemini-model-container');
        if (updatedKeys.length === 0) {
          if (modelContainer) modelContainer.style.display = 'none';
        }
        renderAiStatusMonitor();
      });
    });
  }

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
      if (changes.spelt_allow_background_ai) {
        const el = document.getElementById('setting-allow-background-ai');
        if (el) el.checked = !!changes.spelt_allow_background_ai.newValue;
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

  // Initial render of AI model status monitor
  renderAiStatusMonitor();

  // Periodically refresh the status monitor to reflect remaining cooldown times
  setInterval(renderAiStatusMonitor, 2000);
}

async function renderAiStatusMonitor() {
  const monitorBlock = document.getElementById('ai-status-monitor-block');
  const container = document.getElementById('ai-status-list-container');
  if (!monitorBlock || !container) return;

  const res = await new Promise(r => chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key'], r)) || {};
  const keys = res.spelt_gemini_keys || [];
  const hasKeys = keys.length > 0 || !!res.spelt_gemini_key;

  if (!hasKeys) {
    monitorBlock.style.display = 'none';
    return;
  }

  try {
    const statuses = await getAiStatus();
    if (statuses.length === 0) {
      monitorBlock.style.display = 'none';
      return;
    }

    monitorBlock.style.display = 'flex';
    container.innerHTML = '';

    let lastUsedName = 'none';

    statuses.forEach(item => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '5px 8px';
      
      if (item.isCurrentSelection) {
        row.style.background = 'hsla(160, 60%, 45%, 0.06)';
        row.style.border = '1px solid hsla(160, 60%, 45%, 0.25)';
      } else {
        row.style.background = 'rgba(255, 255, 255, 0.03)';
        row.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      }
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.fontSize = '0.66rem';

      let indicatorHtml = '';
      let statusText = 'Ready';
      let indicatorColor = 'var(--success)';

      if (item.status === 'bad') {
        indicatorColor = 'var(--danger)';
        statusText = 'Failed/Blocked';
        indicatorHtml = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${indicatorColor}; margin-right: 4px;"></span>`;
      } else if (item.status === 'cooldown') {
        indicatorColor = '#f59e0b'; // orange
        statusText = `Cooldown (${item.cooldownRemaining}s)`;
        indicatorHtml = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${indicatorColor}; margin-right: 4px; animation: pulse 1s infinite alternate;"></span>`;
      } else {
        indicatorHtml = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${indicatorColor}; margin-right: 4px;"></span>`;
      }

      let badgesHtml = '';
      if (item.isPreferred) {
        badgesHtml += `<span style="background: hsla(260, 60%, 50%, 0.25); border: 1px solid hsla(260, 60%, 65%, 0.35); color: #c4b5fd; font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">Preferred</span>`;
      }
      if (item.isCurrentSelection) {
        badgesHtml += `<span style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; margin-left: 4px; font-weight: 700; box-shadow: 0 0 4px rgba(16, 185, 129, 0.15);">Selected</span>`;
      }
      if (item.isLastUsed) {
        badgesHtml += `<span style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-muted); font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">Last Used</span>`;
        lastUsedName = item.name.replace('models/', '');
      }

      const modelShort = item.name.replace('models/', '');
      const labelName = `${modelShort} <span style="opacity: 0.5; font-size: 0.6rem;">(Key: ...${item.keyId})</span>`;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; font-weight: 500; color: var(--text);">
          <span>${labelName}</span>
          ${badgesHtml}
        </div>
        <div style="display: flex; align-items: center; color: var(--text-muted); font-size: 0.62rem;">
          ${indicatorHtml}
          <span>${statusText}</span>
        </div>
      `;

      container.appendChild(row);
    });

    const lastUsedEl = document.getElementById('ai-monitor-last-used-label');
    if (lastUsedEl) {
      lastUsedEl.textContent = lastUsedName !== 'none' ? `Active: ${lastUsedName}` : 'No model used yet';
    }
  } catch (err) {
    console.error('Error rendering status monitor:', err);
  }
}


async function triggerRetranslate() {
  const allowRes = await new Promise(r => chrome.storage?.local.get('spelt_allow_background_ai', r));
  if (!allowRes || !allowRes.spelt_allow_background_ai) {
    showConfirm(
      'Background AI Disabled',
      'Background AI processing is currently disabled in Settings to prevent rate limits. Please enable "Allow background AI tasks" in Settings first.',
      null,
      false
    );
    return;
  }

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
