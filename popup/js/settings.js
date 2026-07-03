import { showConfirm } from './vault.js';
import { exportDb, importDb, wipeDb } from './settings/actions.js';
import {
  getAiStatus,
  GEMINI_AUTO_MODEL,
  getGeminiKeyFingerprint,
  getGeminiKeyLabel,
  getGeminiModelMeta,
  getGeminiModelOptions,
  isSupportedGeminiTextModel,
  sortGeminiModels,
  getStored,
  setStored
} from '../../shared/storage.js';

let onDbRestoredCallback = null;
let aiStatusIntervalId = null;

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
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Please enter an API Key first.';
      return;
    }

    statusEl.style.display = 'block';
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

      const testModel = availableModels[0];

      statusEl.textContent = `Testing content generation with ${getGeminiModelMeta(testModel).label}...`;
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1/${testModel}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Write the word "connected".' }] }]
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

    for (const key of keys) {
      const fingerprint = getGeminiKeyFingerprint(key);
      if (!Array.isArray(keyModelsMap[fingerprint]) || keyModelsMap[fingerprint].length === 0) {
        const discovered = await fetchModelsForKey(key).catch(err => {
          console.warn('Could not refresh Gemini model list for a saved key:', err);
          return [];
        });
        if (discovered.length > 0) {
          keyModelsMap[fingerprint] = discovered;
          keyModelsChanged = true;
        }
      }
    }

    pruneKeyModelsMap(keyModelsMap, keys);
    const modelList = collectModelsFromKeyMap(keyModelsMap, keys, res.spelt_gemini_models_list || []);
    const currentModel = normalizeModelSelection(res.spelt_gemini_model);
    const nextModel = currentModel === GEMINI_AUTO_MODEL || modelList.includes(currentModel)
      ? currentModel
      : GEMINI_AUTO_MODEL;

    await setGeminiStorage({
      spelt_gemini_models_list: modelList,
      spelt_gemini_key_models: keyModelsMap,
      spelt_gemini_model: nextModel
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
      listContainer.innerHTML = '<p style="font-size: 0.65rem; color: var(--text-muted); margin: 4px 0;">No API keys added yet.</p>';
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

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-key-btn';
      removeBtn.type = 'button';
      removeBtn.title = 'Remove key';
      removeBtn.textContent = 'x';
      removeBtn.addEventListener('click', () => {
        removeKey(key);
      });

      row.append(keyInfo, removeBtn);
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
          if (modelContainer) modelContainer.style.display = 'none';
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
  if (aiStatusIntervalId) clearInterval(aiStatusIntervalId);
  aiStatusIntervalId = setInterval(renderAiStatusMonitor, 2000);
}

function getGeminiStorage() {
  return new Promise(resolve => {
    chrome.storage?.local.get([
      'spelt_gemini_keys',
      'spelt_gemini_key',
      'spelt_gemini_model',
      'spelt_gemini_models_list',
      'spelt_gemini_key_models'
    ], res => resolve(res || {}));
  });
}

function setGeminiStorage(updates) {
  return new Promise(resolve => {
    chrome.storage?.local.set(updates, resolve);
  });
}

async function fetchModelsForKey(key) {
  const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
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

function collectModelsFromKeyMap(keyModelsMap, keys, fallbackModels = []) {
  const models = [];
  keys.forEach(key => {
    const keyModels = keyModelsMap[getGeminiKeyFingerprint(key)] || [];
    models.push(...keyModels);
  });
  if (models.length === 0) models.push(...fallbackModels);
  return sortGeminiModels(models);
}

async function renderModelSelect(selectedModel = GEMINI_AUTO_MODEL, hasKeys = true) {
  const modelSelect = document.getElementById('setting-gemini-model');
  const modelContainer = document.getElementById('gemini-model-container');
  if (!modelSelect || !modelContainer) return;

  if (!hasKeys) {
    modelContainer.style.display = 'none';
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
  modelContainer.style.display = 'flex';
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

function summarizeIssueBuckets(issues) {
  const sorted = [...issues.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 4).map(([name, count]) => `${name} (${count})`);
}

function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return asNum;
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && typeof value.getTime === 'function') {
    const ts = value.getTime();
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

function inferPracticeType(card) {
  const tokenCount = String(card.word || '').trim().split(/\s+/).filter(Boolean).length;
  const hasBlocks = Array.isArray(card.blocks) && card.blocks.length > 0;
  const pos = String(card.partOfSpeech || '').toLowerCase();
  if (hasBlocks || pos.includes('grammatical pattern') || tokenCount > 3) return 'syntax';
  if (tokenCount > 1) return 'recall';
  return 'spelling';
}

function makeCardId(index) {
  return `word_repaired_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

async function runIntegrityAudit({ repair = false } = {}) {
  const issueBuckets = new Map();
  let issueCount = 0;
  let fixedCount = 0;

  const bump = (bucket, fixed = false) => {
    issueCount += 1;
    issueBuckets.set(bucket, (issueBuckets.get(bucket) || 0) + 1);
    if (fixed) fixedCount += 1;
  };

  const rawWords = await getStored('spelt_words');
  const sourceWords = Array.isArray(rawWords) ? rawWords : [];

  if (!Array.isArray(rawWords)) {
    bump('Words root not array', repair);
  }

  const seenIds = new Set();
  const repairedWords = [];
  const allowedPracticeTypes = new Set(['spelling', 'recall', 'syntax', 'both']);
  const allowedLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

  sourceWords.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      bump('Invalid word record', repair);
      if (!repair) repairedWords.push(item);
      return;
    }

    const card = { ...item };

    if (typeof card.word !== 'string' || card.word.trim() === '') {
      bump('Missing word text', repair);
      if (!repair) repairedWords.push(card);
      return;
    }
    card.word = card.word.trim();

    if (typeof card.id !== 'string' || card.id.trim() === '') {
      bump('Missing card id', repair);
      if (repair) card.id = makeCardId(idx);
    } else {
      card.id = card.id.trim();
    }

    if (seenIds.has(card.id)) {
      bump('Duplicate card id', repair);
      if (repair) {
        card.id = makeCardId(idx);
      }
    }
    seenIds.add(card.id);

    if (!allowedPracticeTypes.has(card.practiceType)) {
      bump('Invalid practice type', repair);
      if (repair) card.practiceType = inferPracticeType(card);
    }

    const nextTs = parseTimestamp(card.nextDate);
    if (!Number.isFinite(nextTs)) {
      bump('Invalid nextDate', repair);
      if (repair) card.nextDate = Date.now();
    } else if (repair) {
      card.nextDate = nextTs;
    }

    const meaningNextTs = parseTimestamp(card.meaningNextDate);
    if (!Number.isFinite(meaningNextTs)) {
      bump('Invalid meaningNextDate', repair);
      if (repair) card.meaningNextDate = Date.now();
    } else if (repair) {
      card.meaningNextDate = meaningNextTs;
    }

    if (!Number.isFinite(Number(card.ef)) || Number(card.ef) < 1.3) {
      bump('Invalid ef', repair);
      if (repair) card.ef = 2.5;
    }
    if (!Number.isFinite(Number(card.meaningEf)) || Number(card.meaningEf) < 1.3) {
      bump('Invalid meaningEf', repair);
      if (repair) card.meaningEf = 2.5;
    }

    if (!Array.isArray(card.misspellings)) {
      bump('Invalid misspellings list', repair);
      if (repair) card.misspellings = [];
    }
    if (!Array.isArray(card.otherLevels)) {
      bump('Invalid otherLevels list', repair);
      if (repair) card.otherLevels = [];
    }
    if (card.history !== undefined && !Array.isArray(card.history)) {
      bump('Invalid history list', repair);
      if (repair) card.history = [];
    }

    if (card.practiceType === 'syntax') {
      if (!Array.isArray(card.blocks)) {
        bump('Syntax card missing blocks', repair);
        if (repair) card.blocks = [];
      }
      if (!Array.isArray(card.joints)) {
        bump('Syntax card missing joints', repair);
        if (repair) card.joints = [];
      }
      if (typeof card.writingExample !== 'string') {
        bump('Syntax card missing writingExample', repair);
        if (repair) card.writingExample = card.example || '';
      }
    }

    if (typeof card.level === 'string' && card.level.trim()) {
      const upper = card.level.trim().toUpperCase();
      if (!allowedLevels.has(upper)) {
        bump('Invalid CEFR level', repair);
        if (repair) card.level = '';
      } else if (repair) {
        card.level = upper;
      }
    }

    repairedWords.push(card);
  });

  const activity = await getStored('spelt_activity');
  if (activity !== undefined && (typeof activity !== 'object' || Array.isArray(activity) || activity === null)) {
    bump('Invalid activity object', repair);
    if (repair) await setStored('spelt_activity', {});
  }

  const streak = await getStored('spelt_streak');
  const streakValid = streak && typeof streak === 'object' && !Array.isArray(streak);
  if (!streakValid) {
    bump('Invalid streak object', repair);
    if (repair) await setStored('spelt_streak', { current: 0, lastDate: '', max: 0 });
  } else if (repair) {
    const normalizedStreak = {
      current: Number.isFinite(Number(streak.current)) ? Number(streak.current) : 0,
      lastDate: typeof streak.lastDate === 'string' ? streak.lastDate : '',
      max: Number.isFinite(Number(streak.max)) ? Number(streak.max) : 0
    };
    await setStored('spelt_streak', normalizedStreak);
  }

  const sessions = await getStored('spelt_sessions');
  if (sessions !== undefined && !Array.isArray(sessions)) {
    bump('Invalid sessions list', repair);
    if (repair) await setStored('spelt_sessions', []);
  }

  const sandbox = await getStored('spelt_sandbox_activity');
  if (sandbox !== undefined && (typeof sandbox !== 'object' || Array.isArray(sandbox) || sandbox === null)) {
    bump('Invalid sandbox activity object', repair);
    if (repair) await setStored('spelt_sandbox_activity', {});
  }

  const geminiKeysRaw = await getStored('spelt_gemini_keys');
  const legacyKey = await getStored('spelt_gemini_key');
  const keyModelsRaw = await getStored('spelt_gemini_key_models');
  const keyModels = keyModelsRaw && typeof keyModelsRaw === 'object' && !Array.isArray(keyModelsRaw)
    ? { ...keyModelsRaw }
    : {};

  const keys = Array.isArray(geminiKeysRaw) ? geminiKeysRaw.filter(Boolean) : (legacyKey ? [legacyKey] : []);
  const fingerprints = new Set(keys.map(k => getGeminiKeyFingerprint(k)));
  let mapChanged = false;

  Object.keys(keyModels).forEach(fp => {
    if (!fingerprints.has(fp)) {
      bump('Orphan Gemini key-model mapping', repair);
      if (repair) {
        delete keyModels[fp];
        mapChanged = true;
      }
    } else if (!Array.isArray(keyModels[fp])) {
      bump('Invalid Gemini model list', repair);
      if (repair) {
        keyModels[fp] = [];
        mapChanged = true;
      }
    }
  });

  if (repair) {
    await setStored('spelt_words', repairedWords);
    if (mapChanged) {
      await setStored('spelt_gemini_key_models', keyModels);
      await setStored('spelt_gemini_models_list', collectModelsFromKeyMap(keyModels, keys));
    }
  }

  return {
    issueCount,
    fixedCount,
    topCategories: summarizeIssueBuckets(issueBuckets)
  };
}
