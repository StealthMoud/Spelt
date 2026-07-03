import { getStored } from './core.js';

/**
 * Model Tier List — ordered strongest → weakest.
 * Only includes models known to work well for text/JSON generation.
 * Image-specific and Gemma models removed (they don't support responseMimeType
 * and are weaker for structured JSON output).
 */
const MODEL_TIERS = [
  'models/gemini-2.5-flash',
  'models/gemini-2.5-flash-lite',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-lite',
];

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
 * Get a safe short identifier for an API key.
 */
function getKeyIdentifier(key) {
  if (!key) return 'unknown';
  return key.slice(-6) || 'key';
}

/**
 * Generate trial sequence: try the strongest model across all keys first.
 */
async function getTrialSequence(modelTiers, keys) {
  const sequence = [];
  for (const model of modelTiers) {
    for (const key of keys) {
      sequence.push({ model, key });
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
 * Check if a rate limit error is global to the entire API key (such as free tier requests quota).
 */
/**
 * Apply a cooldown timer to a model.
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
 * The user's preferred model (from settings) is always tried first.
 */
async function getAvailableModelTiers(preferredModel) {
  const storedList = await getStored('spelt_gemini_models_list') || [];
  const availableSet = new Set(storedList);

  // Normalize the preferred model
  const cleanPreferred = preferredModel.startsWith('models/') ? preferredModel : 'models/' + preferredModel;

  // Build ordered list: preferred first, then tiers in order (excluding preferred to avoid dupes)
  const ordered = [cleanPreferred];
  for (const tier of MODEL_TIERS) {
    if (tier !== cleanPreferred && availableSet.has(tier)) {
      ordered.push(tier);
    }
  }

  // Also add any available models not in our tier list (at the end, as unknown-tier fallbacks)
  // but skip image-only and gemma models that are known to be problematic
  for (const m of storedList) {
    if (!ordered.includes(m) && !isProblematicModel(m)) {
      ordered.push(m);
    }
  }

  return ordered;
}

/**
 * Check if a model name indicates it's problematic for text/JSON generation.
 * Image-specific models and Gemma models are filtered out.
 */
function isProblematicModel(modelName) {
  const name = modelName.toLowerCase();
  return name.includes('-image') || name.includes('gemma');
}

/**
 * Find the best available model — the highest-tier model that is not bad and not in cooldown.
 * Returns the model name string, or null if all exhausted.
 */
async function pickBestAvailableModel(models, keys) {
  const badModels = await getBadModels();
  const cooldowns = await getCooldowns();
  const now = Date.now();
  for (const model of models) {
    for (const key of keys) {
      const trialId = `${model}::${getKeyIdentifier(key)}`;
      if (badModels.has(trialId)) continue;
      const cooldownUntil = cooldowns[trialId] || 0;
      if (now >= cooldownUntil) {
        return model;
      }
    }
  }
  return null; // All rate-limited or bad
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
 * Tries the preferred model first, then falls back through tiers.
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
      chrome.storage?.local.set({ spelt_last_used_model: model });
      
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
          chrome.storage?.local.set({ spelt_last_used_model: model });
          
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
  const waitSec = getShortestWait(cooldownsAfter);
  const hasRateLimited = Object.values(cooldownsAfter).some(t => t > Date.now());

  if (hasRateLimited) {
    throw new Error(`All available AI models and API keys are rate-limited. Please retry in ~${waitSec}s.`);
  } else {
    const errorMsg = lastError ? lastError.message : 'No available AI models or keys.';
    throw new Error(`AI request failed: ${errorMsg}`);
  }
}

/**
 * Sends a prompt to Google Gemini API and returns the parsed JSON response.
 * Requires spelt_gemini_key to be set in chrome.storage.local.
 * Automatically falls back to weaker models on rate limit.
 */
export async function askGemini(prompt) {
  return enqueue(async () => {
    const keys = await getStoredKeys();
    if (keys.length === 0) {
      throw new Error('No Gemini API keys are configured. Please add an API key in the Settings tab.');
    }

    const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-2.5-flash';
    const modelTiers = await getAvailableModelTiers(preferredModel);

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
 * Automatically falls back to weaker models on rate limit.
 */
export async function askGeminiText(prompt) {
  return enqueue(async () => {
    const keys = await getStoredKeys();
    if (keys.length === 0) {
      throw new Error('No Gemini API keys are configured. Please add an API key in the Settings tab.');
    }

    const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-2.5-flash';
    const modelTiers = await getAvailableModelTiers(preferredModel);

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
  const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-2.5-flash';
  const modelTiers = await getAvailableModelTiers(preferredModel);
  const keys = await getStoredKeys();
  const now = Date.now();
  const lastUsed = await getStored('spelt_last_used_model') || null;

  const badModels = await getBadModels();
  const cooldowns = await getCooldowns();

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
        keyId,
        status,
        cooldownRemaining,
        isPreferred: model === preferredModel || model === ('models/' + preferredModel),
        isLastUsed: model === lastUsed,
        isCurrentSelection: trialId === currentSelectionTrialId
      });
    }
  }

  return results;
}

