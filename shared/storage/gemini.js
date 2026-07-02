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

/**
 * In-memory rate limit cooldown map: modelName → timestamp when cooldown expires.
 * Only used for genuine rate-limit (429) responses.
 * Resets naturally on extension reload.
 */
const rateLimitCooldowns = new Map();

/**
 * In-memory set of models that returned non-recoverable errors (400, 404, etc.).
 * These are permanently skipped for the session — they won't magically start working.
 * Resets on extension reload.
 */
const badModels = new Set();

/**
 * In-memory set of models that do NOT support responseMimeType.
 * When a model fails with a responseMimeType error, we remember it so subsequent
 * calls skip the field for that model immediately instead of wasting a request.
 */
const noMimeTypeSupport = new Set();

/**
 * Returns true if the user has configured a Gemini API key.
 */
export async function isGeminiConfigured() {
  const key = await getStored('spelt_gemini_key');
  return !!key;
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
function pickBestAvailableModel(models) {
  const now = Date.now();
  for (const model of models) {
    if (badModels.has(model)) continue;
    const cooldownUntil = rateLimitCooldowns.get(model) || 0;
    if (now >= cooldownUntil) {
      return model;
    }
  }
  return null; // All rate-limited or bad
}

/**
 * Get the shortest remaining cooldown across all rate-limited models (in seconds).
 */
function getShortestWait() {
  const now = Date.now();
  let shortest = Infinity;
  for (const [, expiresAt] of rateLimitCooldowns) {
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
 * @param {string} key - API key
 * @param {object} bodyPayload - The request body (contents, generationConfig, etc.)
 * @param {string[]} modelTiers - Ordered list of model names to try
 * @param {boolean} wantJson - Whether to request JSON output via responseMimeType
 * @returns {{ response: Response, modelUsed: string }}
 */
async function fetchWithFallback(key, bodyPayload, modelTiers, wantJson = false) {
  let lastError = null;

  for (const model of modelTiers) {
    // Skip permanently bad models
    if (badModels.has(model)) continue;

    // Skip models currently in rate-limit cooldown
    const cooldownUntil = rateLimitCooldowns.get(model) || 0;
    if (Date.now() < cooldownUntil) continue;

    // Determine whether to use responseMimeType for this model
    const useMimeType = wantJson && !noMimeTypeSupport.has(model);

    // Build the actual payload
    const payload = useMimeType
      ? { ...bodyPayload, generationConfig: { ...(bodyPayload.generationConfig || {}), responseMimeType: 'application/json' } }
      : bodyPayload;

    try {
      const response = await callModel(key, model, payload);
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
          return { response, modelUsed: model };
        } catch (retryErr) {
          // If the retry also fails, handle based on error type
          const retryStatus = retryErr.status;
          const retryMsg = retryErr.apiMessage || retryErr.message;

          if (isRateLimitError(retryStatus, retryMsg)) {
            const delay = parseRetryDelay(retryMsg);
            rateLimitCooldowns.set(model, Date.now() + delay);
            console.warn(`[Spelt AI] Model ${model} rate-limited. Cooldown ${Math.ceil(delay / 1000)}s.`);
          } else {
            // Non-recoverable error on retry — blacklist this model
            badModels.add(model);
            console.warn(`[Spelt AI] Model ${model} failed (status ${retryStatus}). Blacklisted for this session.`);
          }
          lastError = retryErr;
          continue;
        }
      }

      // Case 2: Genuine rate limit (429 or quota error)
      if (isRateLimitError(status, errMsg)) {
        const delay = parseRetryDelay(errMsg);
        rateLimitCooldowns.set(model, Date.now() + delay);
        console.warn(`[Spelt AI] Model ${model} rate-limited. Cooldown ${Math.ceil(delay / 1000)}s. Trying next tier...`);
        lastError = err;
        continue;
      }

      // Case 3: Network error (Failed to fetch — offline, CORS, etc.)
      if (!status) {
        console.warn(`[Spelt AI] Model ${model} fetch exception: ${err.message}. Trying next tier...`);
        // Don't blacklist — could be transient network issue. Apply short cooldown.
        rateLimitCooldowns.set(model, Date.now() + 15000); // 15s for network errors
        lastError = err;
        continue;
      }

      // Case 4: Other HTTP errors (400 for bad payload, 404 model not found, etc.)
      // These are permanent for this session — the model won't start working.
      badModels.add(model);
      console.warn(`[Spelt AI] Model ${model} failed (status ${status}): ${errMsg}. Blacklisted for this session.`);
      lastError = err;
    }
  }

  // All models exhausted
  const waitSec = getShortestWait();
  const hasRateLimited = [...rateLimitCooldowns.values()].some(t => t > Date.now());

  if (hasRateLimited) {
    throw new Error(`All available AI models are rate-limited. Please retry in ~${waitSec}s.`);
  } else {
    const errorMsg = lastError ? lastError.message : 'No available AI models.';
    throw new Error(`AI request failed: ${errorMsg}`);
  }
}

/**
 * Sends a prompt to Google Gemini API and returns the parsed JSON response.
 * Requires spelt_gemini_key to be set in chrome.storage.local.
 * Automatically falls back to weaker models on rate limit.
 */
export async function askGemini(prompt) {
  const key = await getStored('spelt_gemini_key');
  if (!key) {
    throw new Error('Gemini API key is not configured. Please add your key in the Settings tab.');
  }

  const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-2.5-flash';
  const modelTiers = await getAvailableModelTiers(preferredModel);

  const result = await fetchWithFallback(key, {
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
}

/**
 * Sends a prompt to Gemini and returns raw text (not JSON).
 * Used for free-form responses like hints, mnemonics, and feedback.
 * Automatically falls back to weaker models on rate limit.
 */
export async function askGeminiText(prompt) {
  const key = await getStored('spelt_gemini_key');
  if (!key) {
    throw new Error('Gemini API key is not configured. Please add your key in the Settings tab.');
  }

  const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-2.5-flash';
  const modelTiers = await getAvailableModelTiers(preferredModel);

  const result = await fetchWithFallback(key, {
    contents: [{ parts: [{ text: prompt }] }]
  }, modelTiers, false /* wantJson */);

  const data = await result.response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid empty response from Gemini API.');
  }

  return text.trim();
}
