import { getStored } from './core.js';

/**
 * Model strategy and catalog — ordered strongest → weakest for text/JSON tasks.
 * Keep this list focused on generateContent text-output models; media, live,
 * embedding, robotics, and Gemma endpoints are intentionally excluded.
 */
export const GEMINI_AUTO_MODEL = 'auto';

const MODEL_CATALOG = [
  {
    name: 'models/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    family: 'Gemini 3',
    tier: 'Strongest reasoning',
    stability: 'Preview',
    note: 'Best available reasoning model when your key exposes it.'
  },
  {
    name: 'models/gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    family: 'Gemini 3',
    tier: 'Frontier preview',
    stability: 'Preview',
    note: 'Newest high-capability Flash preview for text-output tasks.'
  },
  {
    name: 'models/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    family: 'Gemini 3',
    tier: 'Strong balanced',
    stability: 'Stable',
    note: 'Strong default for fast vocabulary and JSON tasks.'
  },
  {
    name: 'models/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    family: 'Gemini 2.5',
    tier: 'Deep reasoning',
    stability: 'Stable',
    note: 'Older but still very capable for complex JSON generation.'
  },
  {
    name: 'models/gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    family: 'Gemini 3',
    tier: 'Efficient',
    stability: 'Stable',
    note: 'Fast fallback for lightweight requests.'
  },
  {
    name: 'models/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    family: 'Gemini 2.5',
    tier: 'Balanced',
    stability: 'Stable',
    note: 'Reliable price-performance fallback.'
  },
  {
    name: 'models/gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    family: 'Gemini 2.5',
    tier: 'Lightweight',
    stability: 'Stable',
    note: 'Lowest-cost fallback for simple prompts.'
  },
  {
    name: 'models/gemini-flash-latest',
    label: 'Gemini Flash Latest',
    family: 'Alias',
    tier: 'Latest alias',
    stability: 'Latest',
    note: 'Alias that may move to a newer Flash release.'
  },
  {
    name: 'models/gemini-pro-latest',
    label: 'Gemini Pro Latest',
    family: 'Alias',
    tier: 'Latest alias',
    stability: 'Latest',
    note: 'Alias that may move to a newer Pro release.'
  }
];

const MODEL_TIERS = MODEL_CATALOG.map(model => model.name);

const MODEL_META_BY_NAME = new Map(MODEL_CATALOG.map(model => [model.name, model]));

const BLOCKED_MODEL_NAME_PARTS = [
  'gemini-1.5',
  'gemini-2.0',
  'embedding',
  'imagen',
  'image',
  'banana',
  'veo',
  'tts',
  'live',
  'audio',
  'music',
  'lyria',
  'robotics',
  'computer-use',
  'customtools',
  'deep-research',
  'antigravity',
  'aqa',
  'gemma',
  'omni'
];

function normalizeModelName(modelName) {
  if (!modelName) return '';
  return modelName.startsWith('models/') ? modelName : `models/${modelName}`;
}

export function getGeminiKeyFingerprint(key) {
  if (!key) return 'unknown';
  return `k${key.length}_${key.slice(0, 4)}_${key.slice(-8)}`;
}

export function getGeminiKeyLabel(key) {
  if (!key) return 'unknown';
  return key.length > 12 ? `${key.slice(0, 4)}...${key.slice(-6)}` : key;
}

export function getGeminiModelMeta(modelName) {
  const normalized = normalizeModelName(modelName);
  const known = MODEL_META_BY_NAME.get(normalized);
  if (known) return known;

  const label = normalized.replace('models/', '').replace(/-/g, ' ');
  const displayLabel = label.replace(/\b\w/g, ch => ch.toUpperCase());
  return {
    name: normalized,
    label: displayLabel,
    family: inferModelFamily(normalized),
    tier: inferModelTier(normalized),
    stability: inferModelStability(normalized),
    note: 'Discovered from this key.'
  };
}

export function isSupportedGeminiTextModel(modelRecordOrName) {
  const name = normalizeModelName(typeof modelRecordOrName === 'string' ? modelRecordOrName : modelRecordOrName?.name);
  if (!name) return false;

  if (modelRecordOrName && typeof modelRecordOrName !== 'string') {
    const methods = modelRecordOrName.supportedGenerationMethods || [];
    if (!methods.includes('generateContent')) return false;
  }

  const lower = name.toLowerCase();
  return !BLOCKED_MODEL_NAME_PARTS.some(part => lower.includes(part));
}

export function sortGeminiModels(models) {
  return [...new Set((models || []).map(normalizeModelName).filter(isSupportedGeminiTextModel))]
    .sort((a, b) => {
      const diff = getModelSortRank(a) - getModelSortRank(b);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
}

export async function getGeminiModelOptions() {
  const storedList = await getStored('spelt_gemini_models_list') || [];
  return sortGeminiModels(storedList.length > 0 ? storedList : MODEL_TIERS);
}

function getModelSortRank(modelName) {
  const normalized = normalizeModelName(modelName);
  const knownIndex = MODEL_TIERS.indexOf(normalized);
  if (knownIndex !== -1) return knownIndex;

  const lower = normalized.toLowerCase();
  const versionMatch = lower.match(/gemini-(\d+(?:\.\d+)?)/);
  const version = versionMatch ? Number(versionMatch[1]) : 0;
  let rank = 1000 - version * 100;

  if (lower.includes('pro')) rank -= 30;
  if (lower.includes('flash')) rank -= 12;
  if (lower.includes('lite')) rank += 18;
  if (lower.includes('latest')) rank -= 8;
  if (lower.includes('preview')) rank += 6;
  if (lower.includes('experimental') || lower.includes('exp')) rank += 35;

  return rank;
}

function inferModelFamily(modelName) {
  const lower = modelName.toLowerCase();
  const versionMatch = lower.match(/gemini-(\d+(?:\.\d+)?)/);
  if (versionMatch) return `Gemini ${versionMatch[1]}`;
  if (lower.includes('latest')) return 'Alias';
  return 'Other';
}

function inferModelTier(modelName) {
  const lower = modelName.toLowerCase();
  if (lower.includes('pro')) return 'Reasoning';
  if (lower.includes('flash') && lower.includes('lite')) return 'Efficient';
  if (lower.includes('flash')) return 'Balanced';
  return 'Text';
}

function inferModelStability(modelName) {
  const lower = modelName.toLowerCase();
  if (lower.includes('experimental') || lower.includes('exp')) return 'Experimental';
  if (lower.includes('preview')) return 'Preview';
  if (lower.includes('latest')) return 'Latest';
  return 'Stable';
}

function getKeyIdentifier(key) {
  return getGeminiKeyFingerprint(key);
}

async function getStoredKeyModelsMap() {
  return await getStored('spelt_gemini_key_models') || {};
}

function getModelsForKey(key, globalModelTiers, keyModelsMap) {
  const keyModels = keyModelsMap[getGeminiKeyFingerprint(key)];
  if (!Array.isArray(keyModels) || keyModels.length === 0) return globalModelTiers;
  const keyModelSet = new Set(sortGeminiModels(keyModels));
  return globalModelTiers.filter(model => keyModelSet.has(model));
}

// Persistent storage-backed rate limit cooldowns and blacklisted models
const memoryCooldowns = {};
const memoryBadModels = new Set();

async function getCooldowns() {
  if (chrome.storage?.local) {
    const res = await new Promise(r => chrome.storage.local.get('spelt_rate_limit_cooldowns', r)) || {};
    const data = res.spelt_rate_limit_cooldowns || {};
    const now = Date.now();
    const cleaned = {};
    for (const [model, expiresAt] of Object.entries(data)) {
      if (expiresAt > now) {
        cleaned[model] = expiresAt;
      }
    }
    return cleaned;
  }
  return { ...memoryCooldowns };
}

async function saveCooldowns(cooldowns) {
  if (chrome.storage?.local) {
    await new Promise(r => chrome.storage.local.set({ spelt_rate_limit_cooldowns: cooldowns }, r));
  } else {
    Object.assign(memoryCooldowns, cooldowns);
  }
}

async function getBadModels() {
  if (chrome.storage?.local) {
    const res = await new Promise(r => chrome.storage.local.get('spelt_bad_models', r)) || {};
    return new Set(res.spelt_bad_models || []);
  }
  return new Set(memoryBadModels);
}

async function saveBadModels(badModelsSet) {
  if (chrome.storage?.local) {
    await new Promise(r => chrome.storage.local.set({ spelt_bad_models: [...badModelsSet] }, r));
  } else {
    memoryBadModels.clear();
    for (const m of badModelsSet) memoryBadModels.add(m);
  }
}

/**
 * In-memory set of models that do NOT support responseMimeType.
 * When a model fails with a responseMimeType error, we remember it so subsequent
 * calls skip the field for that model immediately instead of wasting a request.
 */
const noMimeTypeSupport = new Set();

/**
 * Sequential request queue to prevent concurrent requests from cascading
 * through all model tiers simultaneously (which burns quota on every tier).
 * Requests are processed one at a time with minimum spacing.
 */
let requestQueue = Promise.resolve();
const MIN_REQUEST_SPACING_MS = 1000; // 1 second between requests
let lastRequestTime = 0;

async function enqueue(fn) {
  const task = requestQueue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_SPACING_MS) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_SPACING_MS - elapsed));
    }
    lastRequestTime = Date.now();
    return fn();
  });
  // Update the queue head — but don't let a rejection break the chain
  requestQueue = task.catch(() => {});
  return task;
}

/**
 * Load all configured API keys from storage, with automatic migration fallback.
 */
export async function getStoredKeys() {
  const res = await new Promise(r => chrome.storage?.local.get(['spelt_gemini_keys', 'spelt_gemini_key'], r)) || {};
  let keys = res.spelt_gemini_keys || [];
  if (keys.length === 0 && res.spelt_gemini_key) {
    keys = [res.spelt_gemini_key];
  }
  return keys.filter(Boolean);
}

/**
 * Generate trial sequence: try the strongest model across all keys first.
 */
async function getTrialSequence(modelTiers, keys) {
  const sequence = [];
  const keyModelsMap = await getStoredKeyModelsMap();
  for (const model of modelTiers) {
    for (const key of keys) {
      const keyModels = getModelsForKey(key, modelTiers, keyModelsMap);
      if (keyModels.includes(model)) {
        sequence.push({ model, key });
      }
    }
  }
  if (sequence.length === 0 && keys.length > 0) {
    for (const model of modelTiers) {
      for (const key of keys) {
        sequence.push({ model, key });
      }
    }
  }
  return sequence;
}

/**
 * Returns true if the user has configured a Gemini API key.
 */
export async function isGeminiConfigured() {
  const keys = await getStoredKeys();
  return keys.length > 0;
}

/**
 * Parse the retry delay from a Gemini rate limit error message.
 * Looks for patterns like "Please retry in 38.658460616s" or "retry after 60s".
 * Returns delay in milliseconds, or a 60s default.
 */
function parseRetryDelay(errorMessage) {
  const match = errorMessage.match(/retry\s+(?:in|after)\s+([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000);
  }
  return 60000; // 60s default
}

/**
 * Check if an error indicates a rate limit / quota exhaustion.
 */
function isRateLimitError(status, errorMessage) {
  if (status === 429) return true;
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}

/**
 * Check if an error indicates a transient condition (rate limits, 5xx server issues, or temporary overload).
 */
function isTransientError(status, errorMessage) {
  if (!status) return true; // Network errors are transient
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true; // 5xx server issues are transient
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('quota') || 
         msg.includes('rate limit') || 
         msg.includes('resource_exhausted') || 
         msg.includes('high demand') || 
         msg.includes('overloaded') ||
         msg.includes('temporary');
}

/**
 * Apply a cooldown timer to a model/key trial.
 */
async function applyCooldown(model, delay) {
  const expiresAt = Date.now() + delay;
  const cooldowns = await getCooldowns();
  cooldowns[model] = expiresAt;
  await saveCooldowns(cooldowns);
}

/**
 * Check if an error is specifically about responseMimeType not being supported.
 */
function isResponseMimeTypeError(errorMessage) {
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('responsemimetype') || msg.includes('response_mime_type') || msg.includes('responsemime');
}

/**
 * Get the ordered list of available models for fallback, filtered against the user's actual models.
 * Auto mode always scans strongest to weakest. A manual model acts as a first-choice override.
 */
async function getAvailableModelTiers(preferredModel, preferFlash = false) {
  const storedList = await getStored('spelt_gemini_models_list') || [];
  const availableModels = sortGeminiModels(storedList.length > 0 ? storedList : MODEL_TIERS);
  let fallbackModels = availableModels.length > 0 ? availableModels : sortGeminiModels(MODEL_TIERS);

  if (preferFlash) {
    const flashModels = fallbackModels.filter(m => m.toLowerCase().includes('flash') || m.toLowerCase().includes('lite'));
    const proModels = fallbackModels.filter(m => !m.toLowerCase().includes('flash') && !m.toLowerCase().includes('lite'));
    fallbackModels = [...flashModels, ...proModels];
  }

  if (!preferredModel || preferredModel === GEMINI_AUTO_MODEL) {
    return fallbackModels;
  }

  const cleanPreferred = normalizeModelName(preferredModel);
  const ordered = [];
  if (isSupportedGeminiTextModel(cleanPreferred)) ordered.push(cleanPreferred);

  for (const model of fallbackModels) {
    if (!ordered.includes(model)) ordered.push(model);
  }

  return ordered;
}

/**
 * Get the shortest remaining cooldown across all rate-limited models (in seconds).
 */
function getShortestWait(cooldowns) {
  const now = Date.now();
  let shortest = Infinity;
  for (const expiresAt of Object.values(cooldowns)) {
    const remaining = expiresAt - now;
    if (remaining > 0 && remaining < shortest) {
      shortest = remaining;
    }
  }
  return shortest === Infinity ? 60 : Math.ceil(shortest / 1000);
}

/**
 * Make a single API call to a specific model.
 * Returns the Response object on success, or throws with structured error info.
 */
async function callModel(key, model, bodyPayload) {
  const cleanModel = model.startsWith('models/') ? model : 'models/' + model;
  const url = `https://generativelanguage.googleapis.com/v1/${cleanModel}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload)
  });

  if (response.ok) {
    return response;
  }

  // Parse error details
  const errData = await response.json().catch(() => ({}));
  const errMsg = errData.error?.message || '';

  const error = new Error(errMsg || `API returned status ${response.status}`);
  error.status = response.status;
  error.apiMessage = errMsg;
  throw error;
}

/**
 * Core fetch wrapper with automatic model fallback on rate limit.
 * Uses the selected strategy's ordered model/key trials, strongest model first.
 *
 * Key improvements:
 * - If a model fails with a responseMimeType error, retries the SAME model without it
 *   before moving to the next tier (avoids cascading 400 errors across all models).
 * - Models with non-recoverable errors (400 for structural reasons) are blacklisted
 *   for the session, not given a temporary cooldown.
 * - Only genuine rate-limit (429) errors trigger cooldown timers.
 *
 * @param {string[]} keys - API keys
 * @param {object} bodyPayload - The request body (contents, generationConfig, etc.)
 * @param {string[]} modelTiers - Ordered list of model names to try
 * @param {boolean} wantJson - Whether to request JSON output via responseMimeType
 * @returns {{ response: Response, modelUsed: string }}
 */
async function fetchWithFallback(keys, bodyPayload, modelTiers, wantJson = false) {
  let lastError = null;
  const badModels = await getBadModels();
  const cooldowns = await getCooldowns();

  const trials = await getTrialSequence(modelTiers, keys);

  for (const trial of trials) {
    const { model, key } = trial;
    const keyId = getKeyIdentifier(key);
    const trialId = `${model}::${keyId}`;

    // Skip permanently bad model-key pairings
    if (badModels.has(trialId)) continue;

    // Skip trial currently in rate-limit cooldown
    const cooldownUntil = cooldowns[trialId] || 0;
    if (Date.now() < cooldownUntil) continue;

    // Determine whether to use responseMimeType for this model
    const useMimeType = wantJson && !noMimeTypeSupport.has(model);

    // Build the actual payload
    const payload = useMimeType
      ? { ...bodyPayload, generationConfig: { ...(bodyPayload.generationConfig || {}), responseMimeType: 'application/json' } }
      : bodyPayload;

    try {
      const response = await callModel(key, model, payload);
      chrome.storage?.local.set({ spelt_last_used_model: model, spelt_last_used_trial: trialId });
      
      // Success! Clear the cooldown for this model-key in storage so it is immediately marked as Ready
      const currentCooldowns = await getCooldowns();
      if (currentCooldowns[trialId]) {
        delete currentCooldowns[trialId];
        await saveCooldowns(currentCooldowns);
      }
      
      return { response, modelUsed: model };
    } catch (err) {
      const status = err.status;
      const errMsg = err.apiMessage || err.message;

      // Case 1: responseMimeType not supported by this model
      // → Remember it, retry the SAME model without it immediately
      if (useMimeType && isResponseMimeTypeError(errMsg)) {
        noMimeTypeSupport.add(model);
        console.info(`[Spelt AI] Model ${model} doesn't support responseMimeType. Retrying without it...`);

        try {
          // Retry same model without responseMimeType, but add JSON instruction to prompt
          const fallbackPayload = { ...bodyPayload };
          // Strip responseMimeType from generationConfig
          if (fallbackPayload.generationConfig) {
            const { responseMimeType, ...rest } = fallbackPayload.generationConfig;
            fallbackPayload.generationConfig = Object.keys(rest).length > 0 ? rest : undefined;
          }
          // Append JSON instruction to the prompt text
          if (fallbackPayload.contents?.[0]?.parts?.[0]?.text) {
            fallbackPayload.contents[0] = {
              ...fallbackPayload.contents[0],
              parts: [{
                text: fallbackPayload.contents[0].parts[0].text + '\n\nRespond ONLY with a valid JSON block starting with { and ending with }.'
              }]
            };
          }

          const response = await callModel(key, model, fallbackPayload);
          chrome.storage?.local.set({ spelt_last_used_model: model, spelt_last_used_trial: trialId });
          
          // Success! Clear the cooldown for this model-key in storage
          const currentCooldowns = await getCooldowns();
          if (currentCooldowns[trialId]) {
            delete currentCooldowns[trialId];
            await saveCooldowns(currentCooldowns);
          }
          
          return { response, modelUsed: model };
        } catch (retryErr) {
          // If the retry also fails, handle based on error type
          const retryStatus = retryErr.status;
          const retryMsg = retryErr.apiMessage || retryErr.message;

          if (isTransientError(retryStatus, retryMsg)) {
            const isServerErr = retryStatus >= 500;
            const delay = retryStatus === 429 ? parseRetryDelay(retryMsg) : (isServerErr ? 30000 : 15000);
            await applyCooldown(trialId, delay);
            console.warn(`[Spelt AI] Trial ${trialId} transient failure on retry (status ${retryStatus || 'network'}). Cooldown ${Math.ceil(delay / 1000)}s.`);
          } else {
            // Non-recoverable error on retry — blacklist this model
            badModels.add(trialId);
            await saveBadModels(badModels);
            console.warn(`[Spelt AI] Trial ${trialId} failed (status ${retryStatus}). Blacklisted.`);
          }
          lastError = retryErr;
          continue;
        }
      }

      // Case 2: Transient failure (rate limit, 5xx server overload, network drop)
      if (isTransientError(status, errMsg)) {
        const isServerErr = status >= 500;
        const delay = status === 429 ? parseRetryDelay(errMsg) : (isServerErr ? 30000 : 15000);
        await applyCooldown(trialId, delay);
        console.warn(`[Spelt AI] Trial ${trialId} transient failure (status ${status || 'network'}): ${errMsg}. Cooldown ${Math.ceil(delay / 1000)}s. Trying next...`);
        lastError = err;
        continue;
      }

      // Case 3: Other HTTP errors (400 for bad payload, 404 model not found, etc.)
      // These are permanent — the model won't start working.
      badModels.add(trialId);
      await saveBadModels(badModels);
      console.warn(`[Spelt AI] Trial ${trialId} failed (status ${status}): ${errMsg}. Blacklisted.`);
      lastError = err;
    }
  }

  // All models exhausted
  const cooldownsAfter = await getCooldowns();
  const trialIds = new Set(trials.map(trial => `${trial.model}::${getKeyIdentifier(trial.key)}`));
  const relevantCooldowns = Object.fromEntries(Object.entries(cooldownsAfter).filter(([trialId]) => trialIds.has(trialId)));
  const waitSec = getShortestWait(relevantCooldowns);
  const hasRateLimited = Object.values(relevantCooldowns).some(t => t > Date.now());

  if (hasRateLimited) {
    throw new Error(`All available AI models and API keys are rate-limited. Please retry in ~${waitSec}s.`);
  } else {
    const errorMsg = lastError ? lastError.message : 'No available AI models or keys.';
    throw new Error(`AI request failed: ${errorMsg}`);
  }
}

/**
 * Sends a prompt to Google Gemini API and returns the parsed JSON response.
 * Requires Gemini API keys to be set in chrome.storage.local.
 * Automatically falls back through model/key trials on rate limit.
 */
export async function askGemini(prompt, options = {}) {
  const preferFlash = options.preferFlash !== false;
  return enqueue(async () => {
    const keys = await getStoredKeys();
    if (keys.length === 0) {
      throw new Error('No Gemini API keys are configured. Please add an API key in the Settings tab.');
    }

    const preferredModel = await getStored('spelt_gemini_model') || GEMINI_AUTO_MODEL;
    const modelTiers = await getAvailableModelTiers(preferredModel, preferFlash);

    const result = await fetchWithFallback(keys, {
      contents: [{ parts: [{ text: prompt }] }]
    }, modelTiers, true /* wantJson */);

    const data = await result.response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Invalid empty response from Gemini API.');
    }

    // Clean text in case model returned markdown code blocks (e.g. ```json ... ```)
    text = text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```[a-zA-Z]*\n?/, '');
      text = text.replace(/\n?```$/, '');
      text = text.trim();
    }

    // Extract first { and last } if there are prefix/suffix texts
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Failed to parse Gemini response as JSON:', text);
      throw new Error('Gemini response was not valid JSON. Please try again.');
    }
  });
}

/**
 * Sends a prompt to Gemini and returns raw text (not JSON).
 * Used for free-form responses like hints, mnemonics, and feedback.
 * Automatically falls back through model/key trials on rate limit.
 */
export async function askGeminiText(prompt, options = {}) {
  const preferFlash = options.preferFlash !== false;
  return enqueue(async () => {
    const keys = await getStoredKeys();
    if (keys.length === 0) {
      throw new Error('No Gemini API keys are configured. Please add an API key in the Settings tab.');
    }

    const preferredModel = await getStored('spelt_gemini_model') || GEMINI_AUTO_MODEL;
    const modelTiers = await getAvailableModelTiers(preferredModel, preferFlash);

    const result = await fetchWithFallback(keys, {
      contents: [{ parts: [{ text: prompt }] }]
    }, modelTiers, false /* wantJson */);

    const data = await result.response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Invalid empty response from Gemini API.');
    }

    return text.trim();
  });
}

/**
 * Returns the realtime status of all available models.
 */
export async function getAiStatus() {
  const preferredModel = await getStored('spelt_gemini_model') || GEMINI_AUTO_MODEL;
  const modelTiers = await getAvailableModelTiers(preferredModel);
  const keys = await getStoredKeys();
  const now = Date.now();
  const lastUsed = await getStored('spelt_last_used_model') || null;
  const lastUsedTrial = await getStored('spelt_last_used_trial') || null;

  const badModels = await getBadModels();
  const cooldowns = await getCooldowns();
  const keyModelsMap = await getStoredKeyModelsMap();

  // Find which trial is currently designated to handle the NEXT request
  const trials = await getTrialSequence(modelTiers, keys);
  let currentSelectionTrialId = null;
  for (const trial of trials) {
    const trialId = `${trial.model}::${getKeyIdentifier(trial.key)}`;
    if (!badModels.has(trialId)) {
      const cooldownUntil = cooldowns[trialId] || 0;
      if (now >= cooldownUntil) {
        currentSelectionTrialId = trialId;
        break;
      }
    }
  }

  const results = [];
  for (const model of modelTiers) {
    for (const key of keys) {
      const keyModels = getModelsForKey(key, modelTiers, keyModelsMap);
      if (!keyModels.includes(model)) continue;

      const keyId = getKeyIdentifier(key);
      const trialId = `${model}::${keyId}`;

      const cooldownUntil = cooldowns[trialId] || 0;
      const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
      let status = 'ready';
      if (badModels.has(trialId)) {
        status = 'bad';
      } else if (cooldownRemaining > 0) {
        status = 'cooldown';
      }

      results.push({
        name: model,
        model: getGeminiModelMeta(model),
        rank: getModelSortRank(model),
        keyId,
        keyLabel: getGeminiKeyLabel(key),
        trialId,
        status,
        cooldownRemaining,
        isPreferred: preferredModel !== GEMINI_AUTO_MODEL && (model === preferredModel || model === normalizeModelName(preferredModel)),
        isAutoMode: preferredModel === GEMINI_AUTO_MODEL,
        isLastUsed: trialId === lastUsedTrial || (!lastUsedTrial && model === lastUsed),
        isCurrentSelection: trialId === currentSelectionTrialId
      });
    }
  }

  return results;
}
