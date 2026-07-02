import { getStored } from './core.js';

/**
 * Model Tier List — ordered strongest → weakest.
 * At runtime, filtered against the user's actual available models.
 */
const MODEL_TIERS = [
  'models/gemini-3.5-flash',
  'models/gemini-3.1-flash-lite',
  'models/gemini-2.5-pro',
  'models/gemini-2.5-flash',
  'models/gemini-2.5-flash-lite',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-001',
  'models/gemini-2.0-flash-lite',
  'models/gemini-2.0-flash-lite-001',
  'models/gemma-4-31b-it',
  'models/gemma-4-26b-a4b-it',
];

/**
 * In-memory rate limit cooldown map: modelName → timestamp when cooldown expires.
 * Resets naturally on extension reload. No persistent storage needed.
 */
const rateLimitCooldowns = new Map();

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
  for (const m of storedList) {
    if (!ordered.includes(m)) {
      ordered.push(m);
    }
  }

  return ordered;
}

/**
 * Find the best available model — the highest-tier model whose cooldown has expired.
 * Returns the model name string.
 */
function pickBestAvailableModel(models) {
  const now = Date.now();
  for (const model of models) {
    const cooldownUntil = rateLimitCooldowns.get(model) || 0;
    if (now >= cooldownUntil) {
      return model;
    }
  }
  return null; // All rate-limited
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
 * Core fetch wrapper with automatic model fallback on rate limit.
 * Tries the preferred model first, then falls back through tiers.
 *
 * @param {string} key - API key
 * @param {object} bodyPayload - The request body (contents, generationConfig, etc.)
 * @param {string[]} modelTiers - Ordered list of model names to try
 * @returns {{ response: Response, modelUsed: string }}
 */
async function fetchWithFallback(key, bodyPayload, modelTiers) {
  const triedModels = new Set();
  let lastError = null;

  for (const model of modelTiers) {
    // Skip models currently in cooldown
    const cooldownUntil = rateLimitCooldowns.get(model) || 0;
    if (Date.now() < cooldownUntil) {
      triedModels.add(model);
      continue;
    }

    const cleanModel = model.startsWith('models/') ? model : 'models/' + model;
    const url = `https://generativelanguage.googleapis.com/v1/${cleanModel}:generateContent?key=${key}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        return { response, modelUsed: model };
      }

      // Check the error detail
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || '';

      if (isRateLimitError(response.status, errMsg)) {
        // Mark this model as rate-limited
        const delay = parseRetryDelay(errMsg);
        rateLimitCooldowns.set(model, Date.now() + delay);
        console.warn(`[Spelt AI] Model ${model} rate-limited. Cooldown ${Math.ceil(delay / 1000)}s. Trying next tier...`);
        lastError = new Error(errMsg || `Rate limited (status ${response.status})`);
      } else {
        // Other HTTP error (e.g. model not found, invalid parameter, etc.)
        console.warn(`[Spelt AI] Model ${model} failed with status ${response.status}: ${errMsg}. Trying next tier...`);
        rateLimitCooldowns.set(model, Date.now() + 60000); // 60s cooldown for bad models
        lastError = new Error(errMsg || `API returned status ${response.status}`);
      }
      triedModels.add(model);
    } catch (fetchErr) {
      // Catch network-level failures (e.g. TypeError: Failed to fetch due to offline or CORS)
      console.warn(`[Spelt AI] Model ${model} fetch exception: ${fetchErr.message}. Trying next tier...`);
      rateLimitCooldowns.set(model, Date.now() + 60000); // 60s cooldown
      lastError = fetchErr;
      triedModels.add(model);
    }
  }

  // All models exhausted
  const waitSec = getShortestWait();
  const errorMsg = lastError ? lastError.message : 'All AI models are temporarily rate-limited.';
  throw new Error(`${errorMsg} Please retry in ~${waitSec}s.`);
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

  const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-1.5-flash';
  const modelTiers = await getAvailableModelTiers(preferredModel);

  let useMimeType = true;
  let result;

  try {
    result = await fetchWithFallback(key, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    }, modelTiers);
  } catch (err) {
    if (err.message.includes('responseMimeType') || err.message.includes('response_mime_type') || err.message.includes('responseMime')) {
      useMimeType = false;
    } else {
      throw err;
    }
  }

  if (!useMimeType) {
    // Retry without generationConfig responseMimeType
    result = await fetchWithFallback(key, {
      contents: [{ parts: [{ text: prompt + "\n\nRespond ONLY with a valid JSON block starting with { and ending with }." }] }]
    }, modelTiers);
  }

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

  const preferredModel = await getStored('spelt_gemini_model') || 'models/gemini-1.5-flash';
  const modelTiers = await getAvailableModelTiers(preferredModel);

  const result = await fetchWithFallback(key, {
    contents: [{ parts: [{ text: prompt }] }]
  }, modelTiers);

  const data = await result.response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid empty response from Gemini API.');
  }

  return text.trim();
}
