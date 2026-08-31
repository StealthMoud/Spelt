import { showConfirm } from './vault.js';
import { exportDb, importDb, wipeDb } from './settings/actions.js';
import {
  getAiStatus,
  getGeminiKeyLabel,
  getGeminiModelOptions,
  getGeminiModelMeta,
  isSupportedGeminiTextModel,
  sortGeminiModels,
  getGeminiKeyFingerprint,
  collectModelsFromKeyMap,
  GEMINI_AUTO_MODEL,
  GEMINI_API_ROOT
} from '../../shared/storage.js';
import { runIntegrityAudit } from '../../src/data/integrity.js';
import { AI_JOB_ACTIVE_STATES, AI_JOB_KINDS } from '../../src/core/ai_jobs.js';
import {
  getAiJobStatus,
  startAiJob,
  subscribeToAiJob
} from './components/ai_job_client.js';

let onDbRestoredCallback = null;
let aiStatusIntervalId = null;

/** Bump to force every saved key to re-list its models on the next Settings open. */
const MODEL_DISCOVERY_EPOCH = 2;

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

  loadGeminiSettings().catch(err => console.error('Gemini settings load failed:', err));

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
      statusEl.classList.remove('hidden');
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Please enter an API Key first.';
      return;
    }

    if (!key.startsWith('AIza')) {
      statusEl.classList.remove('hidden');
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Invalid key format. Gemini API keys must start with "AIza".';
      return;
    }

    statusEl.classList.remove('hidden');
    statusEl.style.color = 'var(--primary-light)';
    statusEl.textContent = 'Verifying API key...';

    try {
      const existingData = await getGeminiStorage();
      const existingKeys = normalizeStoredKeys(existingData);
      if (existingKeys.includes(key)) {
        statusEl.style.color = 'var(--warning, #f59e0b)';
        statusEl.textContent = 'This API key is already connected.';
        return;
      }

      const availableModels = await fetchModelsForKey(key);

      if (availableModels.length === 0) {
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = 'No text-generation models were found for this API key.';
        return;
      }

      // Verify against the *cheapest* model the key exposes, not the strongest.
      // This call only has to prove the key can generate; running it on a Pro
      // model made adding a key take many seconds and spent quota on the tier
      // the extension is least likely to use.
      const testModel = availableModels[availableModels.length - 1];

      statusEl.textContent = `Testing content generation with ${getGeminiModelMeta(testModel).label}...`;
      const testRes = await fetch(`${GEMINI_API_ROOT}/${testModel}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Write the word "connected".' }] }],
          generationConfig: { maxOutputTokens: 16 }
        })
      });

      if (testRes.ok) {
        statusEl.style.color = 'var(--success)';
        statusEl.textContent = 'API key verified and added.';
        keyInput.value = ''; // clear input

        const latest = await getGeminiStorage();
        const keys = normalizeStoredKeys(latest);
        if (!keys.includes(key)) keys.push(key);

        const keyModelsMap = latest.spelt_gemini_key_models || {};
        keyModelsMap[getGeminiKeyFingerprint(key)] = availableModels;
        pruneKeyModelsMap(keyModelsMap, keys);

        const updatedModelsList = collectModelsFromKeyMap(keyModelsMap, keys);
        const currentModel = normalizeModelSelection(latest.spelt_gemini_model);
        const nextModel = currentModel === GEMINI_AUTO_MODEL || updatedModelsList.includes(currentModel)
          ? currentModel
          : GEMINI_AUTO_MODEL;

        await setGeminiStorage({
          spelt_gemini_keys: keys,
          spelt_gemini_key: keys[0] || '', // legacy fallback
          spelt_gemini_model: nextModel,
          spelt_gemini_models_list: updatedModelsList,
          spelt_gemini_key_models: keyModelsMap
        });

        await renderModelSelect(nextModel, keys.length > 0);
        renderKeysList(keys, keyModelsMap, updatedModelsList);
        renderAiStatusMonitor();
      } else {
        const errData = await testRes.json().catch(() => ({}));
        const errMsg = errData.error?.message || 'Verification request failed';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = `Connected, but model verification failed: ${errMsg}`;
      }
    } catch (err) {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = `Error: ${err.message}`;
    }
  });

  async function loadGeminiSettings() {
    const res = await getGeminiStorage();
    const keys = normalizeStoredKeys(res);
    const keyModelsMap = res.spelt_gemini_key_models || {};
    let keyModelsChanged = false;

    if (keys.length > 0 && (!Array.isArray(res.spelt_gemini_keys) || res.spelt_gemini_keys.length === 0)) {
      await setGeminiStorage({ spelt_gemini_keys: keys, spelt_gemini_key: keys[0] || '' });
    }

    // Lists discovered before the move to v1beta are missing every model that
    // only v1beta exposes, and nothing else would ever refresh them: the loop
    // below re-discovers a key only when its list is empty.
    const staleDiscovery = res.spelt_gemini_discovery_epoch !== MODEL_DISCOVERY_EPOCH;

    // Keys are refreshed together rather than one after another; this runs on
    // every Settings open and each request is an independent round trip.
    await Promise.all(keys.map(async (key) => {
      const fingerprint = getGeminiKeyFingerprint(key);
      const missing = !Array.isArray(keyModelsMap[fingerprint]) || keyModelsMap[fingerprint].length === 0;
      if (!missing && !staleDiscovery) return;

      const discovered = await fetchModelsForKey(key).catch(err => {
        console.warn('Could not refresh Gemini model list for a saved key:', err);
        return [];
      });
      if (discovered.length > 0) {
        keyModelsMap[fingerprint] = discovered;
        keyModelsChanged = true;
      }
    }));

    pruneKeyModelsMap(keyModelsMap, keys);
    const modelList = collectModelsFromKeyMap(keyModelsMap, keys, res.spelt_gemini_models_list || []);
    const currentModel = normalizeModelSelection(res.spelt_gemini_model);
    const nextModel = currentModel === GEMINI_AUTO_MODEL || modelList.includes(currentModel)
      ? currentModel
      : GEMINI_AUTO_MODEL;

    await setGeminiStorage({
      spelt_gemini_models_list: modelList,
      spelt_gemini_key_models: keyModelsMap,
      spelt_gemini_model: nextModel,
      spelt_gemini_discovery_epoch: MODEL_DISCOVERY_EPOCH
    });

    renderKeysList(keys, keyModelsMap, modelList);
    await renderModelSelect(nextModel, keys.length > 0);
    if (keyModelsChanged) renderAiStatusMonitor();
  }

  function renderKeysList(keys, keyModelsMap = {}, fallbackModels = []) {
    const listContainer = document.getElementById('gemini-keys-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    if (keys.length === 0) {
      listContainer.innerHTML = '<p class="empty-keys-note">No API keys added yet.</p>';
      return;
    }

    keys.forEach((key, index) => {
      const row = document.createElement('div');
      row.className = 'gemini-key-row';

      const keyInfo = document.createElement('div');
      keyInfo.className = 'gemini-key-info';

      const title = document.createElement('span');
      title.className = 'gemini-key-title';
      title.textContent = `Key ${index + 1}`;

      const keyText = document.createElement('span');
      keyText.className = 'gemini-key-mask';
      keyText.textContent = getGeminiKeyLabel(key);

      const models = keyModelsMap[getGeminiKeyFingerprint(key)] || fallbackModels;
      const strongest = models.length > 0 ? getGeminiModelMeta(sortGeminiModels(models)[0]).label : 'Models pending';
      const meta = document.createElement('span');
      meta.className = 'gemini-key-meta';
      meta.textContent = `${models.length || 0} text models - Best: ${strongest}`;

      keyInfo.append(title, keyText, meta);

      const keyActions = document.createElement('div');
      keyActions.className = 'gemini-key-actions';

      const testBtn = document.createElement('button');
      testBtn.className = 'test-key-btn';
      testBtn.type = 'button';
      testBtn.textContent = 'Check';
      testBtn.setAttribute('aria-label', `Check Key ${index + 1}`);
      testBtn.addEventListener('click', async () => {
        const statusEl = document.getElementById('gemini-test-status');
        testBtn.disabled = true;
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.style.color = 'var(--text-muted)';
          statusEl.textContent = `Checking Key ${index + 1}...`;
        }

        try {
          const discoveredModels = await fetchModelsForKey(key);
          if (discoveredModels.length === 0) throw new Error('No compatible text models were found.');

          const latest = await getGeminiStorage();
          const latestKeys = normalizeStoredKeys(latest);
          const latestMap = latest.spelt_gemini_key_models || {};
          latestMap[getGeminiKeyFingerprint(key)] = discoveredModels;
          pruneKeyModelsMap(latestMap, latestKeys);
          const modelList = collectModelsFromKeyMap(latestMap, latestKeys);
          await setGeminiStorage({
            spelt_gemini_key_models: latestMap,
            spelt_gemini_models_list: modelList,
            spelt_gemini_discovery_epoch: MODEL_DISCOVERY_EPOCH
          });

          if (statusEl) {
            statusEl.style.color = 'var(--success)';
            statusEl.textContent = `Key ${index + 1} is ready with ${discoveredModels.length} compatible model${discoveredModels.length === 1 ? '' : 's'}.`;
          }
          renderKeysList(latestKeys, latestMap, modelList);
          await renderModelSelect(latest.spelt_gemini_model, true);
          renderAiStatusMonitor();
        } catch (err) {
          testBtn.disabled = false;
          if (statusEl) {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = `Key ${index + 1} failed: ${err.message}`;
          }
        }
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-key-btn';
      removeBtn.type = 'button';
      removeBtn.title = 'Remove key';
      removeBtn.setAttribute('aria-label', `Remove Key ${index + 1}`);
      removeBtn.textContent = 'x';
      removeBtn.addEventListener('click', () => {
        removeKey(key);
      });

      keyActions.append(testBtn, removeBtn);
      row.append(keyInfo, keyActions);
      listContainer.appendChild(row);
    });
  }

  function removeKey(keyToRemove) {
    chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key', 'spelt_gemini_key_models', 'spelt_gemini_model'], async (res) => {
      const keys = normalizeStoredKeys(res);
      const updatedKeys = keys.filter(k => k !== keyToRemove);
      const keyModelsMap = res.spelt_gemini_key_models || {};
      delete keyModelsMap[getGeminiKeyFingerprint(keyToRemove)];
      pruneKeyModelsMap(keyModelsMap, updatedKeys);
      const updatedModelsList = collectModelsFromKeyMap(keyModelsMap, updatedKeys);
      
      const updates = {
        spelt_gemini_keys: updatedKeys,
        spelt_gemini_models_list: updatedModelsList,
        spelt_gemini_key_models: keyModelsMap
      };
      if (res.spelt_gemini_key === keyToRemove) {
        updates.spelt_gemini_key = updatedKeys[0] || '';
      }
      const currentModel = normalizeModelSelection(res.spelt_gemini_model);
      if (currentModel !== GEMINI_AUTO_MODEL && !updatedModelsList.includes(currentModel)) {
        updates.spelt_gemini_model = GEMINI_AUTO_MODEL;
      }

      chrome.storage?.local.set(updates, async () => {
        renderKeysList(updatedKeys, keyModelsMap, updatedModelsList);
        if (updatedKeys.length === 0) {
          const modelContainer = document.getElementById('gemini-model-container');
          if (modelContainer) modelContainer.classList.add('hidden');
        } else {
          await renderModelSelect(updates.spelt_gemini_model || currentModel, true);
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

  document.getElementById('integrity-check-btn')?.addEventListener('click', async () => {
    try {
      const report = await runIntegrityAudit({ repair: false });
      if (report.issueCount === 0) {
        showConfirm('Integrity Check', 'No data issues were found. Your library and analytics storage look healthy.', null, false);
        return;
      }

      const summary = report.topCategories.join(', ');
      showConfirm(
        'Integrity Check',
        `Found ${report.issueCount} issue(s): ${summary}. Apply automatic repair now?`,
        async () => {
          const repairReport = await runIntegrityAudit({ repair: true });
          const verifyReport = await runIntegrityAudit({ repair: false });
          const verifyMsg = verifyReport.issueCount === 0
            ? 'Verification passed: no remaining issues.'
            : `Verification found ${verifyReport.issueCount} remaining issue(s) that need manual review.`;

          showConfirm(
            'Repair Complete',
            `Fixed ${repairReport.fixedCount} issue(s). ${verifyMsg}`,
            null,
            false
          );

          if (onDbRestoredCallback) await onDbRestoredCallback();
        }
      );
    } catch (err) {
      showConfirm('Integrity Check Error', `Could not run integrity check: ${err.message}`, null, false);
    }
  });

  document.getElementById('retranslate-all-btn')?.addEventListener('click', () => {
    showConfirm(
      'Enrich entire vault',
      'Update definitions, translations, parts of speech, levels, and examples for every saved word? This task continues in the background if you close Spelt.',
      async () => {
        try {
          const targetLang = document.getElementById('setting-target-lang')?.value || 'none';
          renderSettingsAiJob(await startAiJob({
            kind: AI_JOB_KINDS.ENRICH_ALL,
            wordIds: [],
            targetLang
          }));
        } catch (err) {
          showConfirm('Could not start enrichment', err.message, null, false);
        }
      }
    );
  });

  subscribeToAiJob(job => {
    renderSettingsAiJob(job);
    if (job?.status === 'completed' && onDbRestoredCallback) {
      onDbRestoredCallback().catch(console.error);
    }
  });
  getAiJobStatus().then(renderSettingsAiJob).catch(() => {});

  renderAiStatusMonitor();

  if (aiStatusIntervalId) clearInterval(aiStatusIntervalId);
  aiStatusIntervalId = setInterval(() => {
    const settingsPane = document.getElementById('settings-tab');
    if (settingsPane && settingsPane.classList.contains('active')) {
      renderAiStatusMonitor();
    }
  }, 2000);
}

export function stopAiStatusMonitor() {
  if (aiStatusIntervalId) {
    clearInterval(aiStatusIntervalId);
    aiStatusIntervalId = null;
  }
}

function getGeminiStorage() {
  return new Promise(resolve => {
    chrome.storage?.local.get([
      'spelt_gemini_keys',
      'spelt_gemini_key',
      'spelt_gemini_model',
      'spelt_gemini_models_list',
      'spelt_gemini_key_models',
      'spelt_gemini_discovery_epoch'
    ], res => resolve(res || {}));
  });
}

function setGeminiStorage(updates) {
  return new Promise(resolve => {
    chrome.storage?.local.set(updates, resolve);
  });
}

async function fetchModelsForKey(key) {
  const modelsRes = await fetch(`${GEMINI_API_ROOT}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': key }
  });
  if (!modelsRes.ok) {
    const errData = await modelsRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Invalid API key or model-list request failed.');
  }

  const modelsData = await modelsRes.json();
  return sortGeminiModels((modelsData.models || [])
    .filter(isSupportedGeminiTextModel)
    .map(m => m.name));
}

function normalizeStoredKeys(res = {}) {
  const keys = Array.isArray(res.spelt_gemini_keys) ? [...res.spelt_gemini_keys] : [];
  if (keys.length === 0 && res.spelt_gemini_key) keys.push(res.spelt_gemini_key);
  return [...new Set(keys.filter(Boolean))];
}

function normalizeModelSelection(modelName) {
  if (!modelName || modelName === GEMINI_AUTO_MODEL) return GEMINI_AUTO_MODEL;
  return modelName.startsWith('models/') ? modelName : `models/${modelName}`;
}

function pruneKeyModelsMap(keyModelsMap, keys) {
  const activeFingerprints = new Set(keys.map(getGeminiKeyFingerprint));
  for (const fingerprint of Object.keys(keyModelsMap)) {
    if (!activeFingerprints.has(fingerprint)) delete keyModelsMap[fingerprint];
  }
}



async function renderModelSelect(selectedModel = GEMINI_AUTO_MODEL, hasKeys = true) {
  const modelSelect = document.getElementById('setting-gemini-model');
  const modelContainer = document.getElementById('gemini-model-container');
  if (!modelSelect || !modelContainer) return;

  if (!hasKeys) {
    modelContainer.classList.add('hidden');
    return;
  }

  const models = await getGeminiModelOptions();
  modelSelect.innerHTML = '';

  const strategyGroup = document.createElement('optgroup');
  strategyGroup.label = 'Strategy';
  const autoOption = document.createElement('option');
  autoOption.value = GEMINI_AUTO_MODEL;
  autoOption.textContent = 'Auto: strongest available';
  strategyGroup.appendChild(autoOption);
  modelSelect.appendChild(strategyGroup);

  const groups = new Map();
  models.forEach(modelName => {
    const meta = getGeminiModelMeta(modelName);
    if (!groups.has(meta.family)) groups.set(meta.family, []);
    groups.get(meta.family).push({ modelName, meta });
  });

  groups.forEach((items, family) => {
    const group = document.createElement('optgroup');
    group.label = family;
    items.forEach(({ modelName, meta }) => {
      const option = document.createElement('option');
      option.value = modelName;
      option.textContent = `${meta.label} (${meta.tier})`;
      group.appendChild(option);
    });
    modelSelect.appendChild(group);
  });

  const selectedValue = normalizeModelSelection(selectedModel);
  const availableValues = new Set([GEMINI_AUTO_MODEL, ...models]);
  modelSelect.value = availableValues.has(selectedValue) ? selectedValue : GEMINI_AUTO_MODEL;
  modelContainer.classList.remove('hidden');
}

function createAiBadge(text, tone = 'neutral') {
  const badge = document.createElement('span');
  badge.className = `ai-status-badge ${tone}`;
  badge.textContent = text;
  return badge;
}

async function renderAiStatusMonitor() {
  const monitorBlock = document.getElementById('ai-status-monitor-block');
  const container = document.getElementById('ai-status-list-container');
  if (!monitorBlock || !container) return;

  const res = await new Promise(r => chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key'], r)) || {};
  const keys = res.spelt_gemini_keys || [];
  const hasKeys = keys.length > 0 || !!res.spelt_gemini_key;

  if (!hasKeys) {
    monitorBlock.classList.add('hidden');
    return;
  }

  try {
    const statuses = await getAiStatus();
    if (statuses.length === 0) {
      monitorBlock.classList.add('hidden');
      return;
    }

    monitorBlock.classList.remove('hidden');
    container.innerHTML = '';

    const groups = new Map();
    let lastUsedName = 'none';

    statuses.forEach(item => {
      if (!groups.has(item.name)) {
        groups.set(item.name, {
          name: item.name,
          model: item.model,
          rank: item.rank,
          items: []
        });
      }
      groups.get(item.name).items.push(item);
      if (item.isLastUsed) {
        lastUsedName = `${item.model.label} / ${item.keyLabel}`;
      }
    });

    [...groups.values()]
      .sort((a, b) => a.rank - b.rank)
      .forEach((group, index) => {
        const row = document.createElement('div');
        const currentItem = group.items.find(item => item.isCurrentSelection);
        row.className = `ai-model-group${currentItem ? ' current' : ''}`;

        const head = document.createElement('div');
        head.className = 'ai-model-group-head';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'ai-model-title-wrap';

        const titleLine = document.createElement('div');
        titleLine.className = 'ai-model-title-line';

        const modelName = document.createElement('span');
        modelName.className = 'ai-model-name';
        modelName.textContent = group.model.label;
        titleLine.appendChild(modelName);

        if (currentItem) titleLine.appendChild(createAiBadge('Selected', 'success'));
        if (group.items.some(item => item.isPreferred)) titleLine.appendChild(createAiBadge('Manual', 'purple'));
        if (group.items.some(item => item.isAutoMode) && index === 0) titleLine.appendChild(createAiBadge('Auto first', 'neutral'));
        if (group.items.some(item => item.isLastUsed)) titleLine.appendChild(createAiBadge('Last used', 'neutral'));

        const subtitle = document.createElement('div');
        subtitle.className = 'ai-model-subtitle';
        subtitle.textContent = `${group.model.tier} - ${group.model.stability} - ${group.items.length} key${group.items.length === 1 ? '' : 's'}`;

        titleWrap.append(titleLine, subtitle);

        const summary = document.createElement('div');
        summary.className = 'ai-model-summary';
        const readyCount = group.items.filter(item => item.status === 'ready').length;
        const cooldownCount = group.items.filter(item => item.status === 'cooldown').length;
        const blockedCount = group.items.filter(item => item.status === 'bad').length;
        summary.textContent = currentItem
          ? `Next: ${currentItem.keyLabel}`
          : `${readyCount} ready${cooldownCount ? ` - ${cooldownCount} cooling` : ''}${blockedCount ? ` - ${blockedCount} blocked` : ''}`;

        head.append(titleWrap, summary);

        const keyLane = document.createElement('div');
        keyLane.className = 'ai-key-chip-lane';
        group.items.forEach(item => {
          const chip = document.createElement('span');
          chip.className = `ai-key-chip ${item.status}${item.isCurrentSelection ? ' current' : ''}`;
          const statusText = item.status === 'cooldown'
            ? `${item.cooldownRemaining}s`
            : item.status === 'bad'
              ? 'Blocked'
              : 'Ready';
          chip.textContent = `${item.keyLabel} - ${statusText}`;
          chip.title = `${group.model.label} on ${item.keyLabel}: ${statusText}`;
          keyLane.appendChild(chip);
        });

        row.append(head, keyLane);
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


function renderSettingsAiJob(job) {
  const status = document.getElementById('settings-ai-job-status');
  const button = document.getElementById('retranslate-all-btn');
  if (!status || !button) return;

  const isActive = !!job && AI_JOB_ACTIVE_STATES.has(job.status);
  button.disabled = isActive;
  status.classList.toggle('hidden', !job);
  if (!job) return;

  if (job.status === 'completed') {
    status.textContent = `Last run: ${job.succeeded} updated${job.failed ? `, ${job.failed} failed` : ''}.`;
  } else if (job.status === 'cancelled') {
    status.textContent = `Last run was cancelled after ${job.completed} of ${job.total} words.`;
  } else if (job.status === 'failed') {
    status.textContent = job.failures?.at(-1)?.message || 'The last enrichment task failed.';
  } else if (job.status === 'cancelling') {
    status.textContent = `Stopping after the current request (${job.completed} of ${job.total}).`;
  } else {
    status.textContent = `Background enrichment: ${job.completed} of ${job.total} words (${job.percent || 0}%).`;
  }
}


