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

function getModelsForKey(key, globalModelTiers, keyModelsMap) {
  const keyModels = keyModelsMap[getGeminiKeyFingerprint(key)];
  if (!Array.isArray(keyModels) || keyModels.length === 0) return globalModelTiers;
  const keyModelSet = new Set(sortGeminiModels(keyModels));
  return globalModelTiers.filter(model => keyModelSet.has(model));
}

function readLocal(fields) {
  if (!chrome.storage?.local) return Promise.resolve({});
  return new Promise(resolve => chrome.storage.local.get(fields, res => resolve(res || {})));
}

function writeLocal(values) {
  chrome.storage?.local?.set(values);
}

function pruneCooldowns(cooldowns) {
  const now = Date.now();
  const live = {};
  for (const [trialId, expiresAt] of Object.entries(cooldowns)) {
    if (expiresAt > now) live[trialId] = expiresAt;
  }
  return live;
}

/**
 * Cooldowns, blacklisted trials, and the per-key model map, held in memory.
 *
 * Every one of these is read on the hot path of a request. Reading them from
 * chrome.storage each time cost six round trips per request — plus two more on
 * success to clear a cooldown that was usually not set — and none of that
 * latency bought anything, since this is the only writer. Storage is now a
 * mirror: reads come from memory, writes are debounced in the background.
 */
const runtime = {
  cooldowns: {},
  badModels: new Set(),
  keyModels: {},
  ready: null
};

/**
 * Bumped when failure handling changes. The old code blacklisted a trial for any
 * 400, including ones caused by a request field the model simply did not accept,
 * so a perfectly good fast model could be struck off permanently and every later
 * request would start further down the tier list. Those verdicts are no longer
 * trustworthy, so they are dropped once and relearned.
 */
const BLACKLIST_EPOCH = 2;

function loadRuntime() {
  if (!runtime.ready) {
    runtime.ready = readLocal(['spelt_rate_limit_cooldowns', 'spelt_bad_models', 'spelt_gemini_key_models', 'spelt_bad_models_epoch'])
      .then(res => {
        runtime.cooldowns = pruneCooldowns(res.spelt_rate_limit_cooldowns || {});
        runtime.keyModels = res.spelt_gemini_key_models || {};

        if (res.spelt_bad_models_epoch === BLACKLIST_EPOCH) {
          runtime.badModels = new Set(res.spelt_bad_models || []);
        } else {
          runtime.badModels = new Set();
          writeLocal({ spelt_bad_models: [], spelt_bad_models_epoch: BLACKLIST_EPOCH });
        }
      })
      .catch(() => { /* no storage yet — the defaults above are correct */ });
  }
  return runtime.ready;
}

let persistTimer = null;
function persistRuntimeSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    runtime.cooldowns = pruneCooldowns(runtime.cooldowns);
    writeLocal({
      spelt_rate_limit_cooldowns: runtime.cooldowns,
      spelt_bad_models: [...runtime.badModels]
    });
  }, 250);
}

async function getCooldowns() {
  await loadRuntime();
  return pruneCooldowns(runtime.cooldowns);
}

async function getBadModels() {
  await loadRuntime();
  return new Set(runtime.badModels);
}

async function getStoredKeyModelsMap() {
  await loadRuntime();
  return runtime.keyModels;
}

/**
 * Fields that a given model rejects. Newer models accept `responseMimeType` and
 * `thinkingConfig`; older ones 400 on them. Remembering the rejection lets the
 * next request skip the field instead of burning a round trip to rediscover it.
 */
const unsupportedFields = new Map();

function isUnsupported(model, field) {
  return unsupportedFields.get(model)?.has(field) === true;
}

function markUnsupported(model, field) {
  if (!unsupportedFields.has(model)) unsupportedFields.set(model, new Set());
  unsupportedFields.get(model).add(field);
}

function unsupportedFieldFrom(message) {
  const msg = (message || '').toLowerCase();
  if (msg.includes('responsemimetype') || msg.includes('response_mime_type') || msg.includes('responsemime')) {
    return 'responseMimeType';
  }
  if (msg.includes('thinkingconfig') || msg.includes('thinking_config') || msg.includes('thinking budget')) {
    return 'thinkingConfig';
  }
  return null;
}

/**
 * In-memory config cache — avoids 6+ chrome.storage.local.get calls per request.
 * Invalidated on writes and after 30s TTL.
 */
const _cache = { keys: null, keysTTL: 0, model: null, modelTTL: 0, modelsList: null, modelsListTTL: 0, keyModels: null, keyModelsTTL: 0 };
const CACHE_TTL = 30000;

function cachedGet(field, fetcher) {
  const now = Date.now();
  if (_cache[field] !== null && now < _cache[field + 'TTL']) return Promise.resolve(_cache[field]);
  return fetcher().then(val => { _cache[field] = val; _cache[field + 'TTL'] = now + CACHE_TTL; return val; });
}

export function invalidateGeminiCache() {
  _cache.keys = null; _cache.model = null; _cache.modelsList = null; _cache.keyModels = null;
}

// Settings writes keys and models from another script/context. Without this the
// caches above stayed stale for up to 30s after adding a key.
globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.spelt_gemini_key_models) {
    runtime.keyModels = changes.spelt_gemini_key_models.newValue || {};
  }
  if (changes.spelt_gemini_keys || changes.spelt_gemini_key ||
      changes.spelt_gemini_model || changes.spelt_gemini_models_list) {
    invalidateGeminiCache();
  }
});

/**
 * Ceiling on simultaneous outbound requests.
 *
 * This used to be a strict serial queue with a 300ms gap between requests, so
 * two panels asking at once meant the second waited out the first end to end.
 * Dead models and exhausted keys are now recorded in memory the moment they
 * fail, so parallel requests no longer each rediscover the same dead tier —
 * the cap is only here to stop a burst from stampeding the API.
 */
const MAX_IN_FLIGHT = 4;
let inFlight = 0;
const waitingForSlot = [];

async function withSlot(fn) {
  if (inFlight >= MAX_IN_FLIGHT) {
    await new Promise(resolve => waitingForSlot.push(resolve));
  } else {
    inFlight++;
  }
  try {
    return await fn();
  } finally {
    inFlight--;
    const next = waitingForSlot.shift();
    if (next) { inFlight++; next(); }
  }
}

/**
 * Load all configured API keys from storage, with automatic migration fallback.
 */
async function _fetchKeys() {
  const res = await readLocal(['spelt_gemini_keys', 'spelt_gemini_key']);
  let keys = res.spelt_gemini_keys || [];
  if (keys.length === 0 && res.spelt_gemini_key) {
    keys = [res.spelt_gemini_key];
  }
  return keys.filter(Boolean);
}
export async function getStoredKeys() {
  return cachedGet('keys', _fetchKeys);
}

/**
 * Generate trial sequence: try the strongest model across all keys first.
 */
async function getTrialSequence(modelTiers, keys) {
  const sequence = [];
  const keyModelsMap = await getStoredKeyModelsMap();
  const add = (model, key) => {
    const keyId = getKeyIdentifier(key);
    sequence.push({ model, key, keyId, trialId: `${model}::${keyId}` });
  };
  for (const model of modelTiers) {
    for (const key of keys) {
      const keyModels = getModelsForKey(key, modelTiers, keyModelsMap);
      if (keyModels.includes(model)) {
        add(model, key);
      }
    }
  }
  if (sequence.length === 0 && keys.length > 0) {
    for (const model of modelTiers) {
      for (const key of keys) {
        add(model, key);
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
export function isRateLimitError(status, errorMessage) {
  if (status === 429) return true;
  const msg = (errorMessage || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}

/**
 * How wide a failure reaches.
 *
 * This distinction is what keeps extra API keys from making things slower. A
 * model the account cannot serve used to be retried once per key before the
 * next tier was tried, so five keys meant five round trips to learn one fact.
 * Scoping the failure lets a dead model skip straight to the next tier while an
 * exhausted key still falls through to the other keys on the same model.
 */
const SCOPE_KEY = 'key';     // this key is spent — same model, different key
const SCOPE_MODEL = 'model'; // no key will serve this model — next tier
const SCOPE_TRIAL = 'trial'; // just this pairing

function classifyFailure(status, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();

  // Quota is billed per key, so the other keys are still worth trying.
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
    return { scope: SCOPE_KEY, transient: true };
  }
  if (status === 401 || status === 403) {
    return { scope: SCOPE_KEY, transient: false };
  }

  // Serving capacity, unlike quota, is a property of the model — every key
  // queues at the same door. Retrying the same overloaded model on the next key
  // just buys the same 503 a second time, so drop a tier instead.
  if (status === 503 || msg.includes('high demand') || msg.includes('overloaded')) {
    return { scope: SCOPE_MODEL, transient: true };
  }
  if (!status || status >= 500 || msg.includes('temporary')) {
    return { scope: SCOPE_TRIAL, transient: true };
  }
  if (status === 404 || msg.includes('is not found') || msg.includes('not supported')) {
    return { scope: SCOPE_MODEL, transient: false };
  }
  return { scope: SCOPE_TRIAL, transient: false };
}

/** Record a failed trial so neither this request nor the next one repeats it. */
function recordFailure(trial, error, { trials, deadModels, deadKeys }) {
  const status = error.status;
  const message = error.apiMessage || error.message;
  const { scope, transient } = classifyFailure(status, message);

  // Narrow the rest of *this* request immediately.
  if (scope === SCOPE_MODEL) deadModels.add(trial.model);
  if (scope === SCOPE_KEY) deadKeys.add(trial.keyId);

  if (transient) {
    const delay = status === 429 ? parseRetryDelay(message) : (status >= 500 ? 5000 : 10000);
    const until = Date.now() + delay;
    // A model-wide outage benches the model on every key, not just this one.
    const affected = scope === SCOPE_MODEL
      ? trials.filter(t => t.model === trial.model)
      : [trial];
    for (const t of affected) runtime.cooldowns[t.trialId] = until;
  } else {
    runtime.badModels.add(trial.trialId);
  }
  persistRuntimeSoon();
  console.warn(`[Spelt AI] ${trial.trialId} failed (${status || 'network'}): ${message}`);
}

function noteSuccess(trial) {
  if (runtime.cooldowns[trial.trialId]) {
    delete runtime.cooldowns[trial.trialId];
    persistRuntimeSoon();
  }
  writeLocal({ spelt_last_used_model: trial.model, spelt_last_used_trial: trial.trialId });
}

/**
 * Get the ordered list of available models for fallback, filtered against the user's actual models.
 * Auto mode always scans strongest to weakest. A manual model acts as a first-choice override.
 */
async function getAvailableModelTiers(preferredModel, preferFlash = false) {
  const storedList = await cachedGet('modelsList', () => getStored('spelt_gemini_models_list').then(v => v || []));
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

const API_ROOT = 'https://generativelanguage.googleapis.com/v1';

/** How long one attempt may go without producing a response before we give up on it. */
const RESPONSE_TIMEOUT_MS = 20000;

/**
 * How long a trial gets to itself before the next key is tried alongside it.
 *
 * Requests used to be strictly one at a time, so a key having a slow minute
 * stalled the whole chain. Hedging turns the spare keys into what the user
 * expects them to be: the first one to answer wins and the rest are cancelled.
 */
const HEDGE_DELAY_MS = 1800;
const MAX_HEDGED_ATTEMPTS = 2;

function apiUrl(model, method, query = '') {
  const cleanModel = model.startsWith('models/') ? model : 'models/' + model;
  return `${API_ROOT}/${cleanModel}:${method}${query}`;
}

async function toApiError(response) {
  const errData = await response.json().catch(() => ({}));
  const errMsg = errData.error?.message || '';
  const error = new Error(errMsg || `API returned status ${response.status}`);
  error.status = response.status;
  error.apiMessage = errMsg;
  return error;
}

/** Mirror an outer abort onto an inner controller; returns the unsubscribe. */
function linkAbort(outerSignal, controller) {
  if (outerSignal.aborted) {
    controller.abort(outerSignal.reason);
    return () => {};
  }
  const forward = () => controller.abort(outerSignal.reason);
  outerSignal.addEventListener('abort', forward, { once: true });
  return () => outerSignal.removeEventListener('abort', forward);
}

/**
 * Build the request body for one model, dropping fields it has already rejected
 * and asking for JSON in whichever way the model supports.
 */
function payloadFor(model, body, wantJson) {
  const generationConfig = { ...(body.generationConfig || {}) };
  if (isUnsupported(model, 'thinkingConfig')) delete generationConfig.thinkingConfig;

  const mimeTypeUsable = wantJson && !isUnsupported(model, 'responseMimeType');
  if (mimeTypeUsable) generationConfig.responseMimeType = 'application/json';

  const payload = { ...body };
  if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;
  else delete payload.generationConfig;

  // Without responseMimeType the shape has to be asked for in words instead.
  if (wantJson && !mimeTypeUsable && body.contents?.[0]?.parts?.[0]?.text) {
    payload.contents = [
      {
        ...body.contents[0],
        parts: [{ text: `${body.contents[0].parts[0].text}\n\nRespond ONLY with a valid JSON block starting with { and ending with }.` }]
      },
      ...body.contents.slice(1)
    ];
  }
  return payload;
}

/**
 * POST to Gemini, failing fast if no response arrives. Resolves as soon as the
 * headers land, so a streaming body is not on the clock.
 */
async function postToGemini(url, key, payload, signal) {
  const controller = new AbortController();
  const unlink = linkAbort(signal, controller);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, RESPONSE_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (timedOut && !signal.aborted) {
      const timeout = new Error(`No response within ${Math.round(RESPONSE_TIMEOUT_MS / 1000)}s.`);
      timeout.status = 0;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    unlink();
  }
}

/**
 * One attempt against one model/key, retrying in place if the only problem was
 * a generationConfig field this model does not know about.
 */
async function requestOnce(trial, body, wantJson, signal, { stream = false } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = stream
      ? apiUrl(trial.model, 'streamGenerateContent', '?alt=sse')
      : apiUrl(trial.model, 'generateContent');

    const response = await postToGemini(url, trial.key, payloadFor(trial.model, body, wantJson), signal);
    if (response.ok) return response;

    const error = await toApiError(response);
    const field = attempt === 0 ? unsupportedFieldFrom(error.apiMessage) : null;
    if (!field || isUnsupported(trial.model, field)) throw error;

    markUnsupported(trial.model, field);
    console.info(`[Spelt AI] ${trial.model} rejected ${field}; retrying without it.`);
  }
  throw new Error('Unreachable');
}

/**
 * Run `attempt` over `trials` in order, but hedge: a trial that has not settled
 * within `hedgeMs` no longer blocks the next one from starting alongside it.
 * The first success wins and every other attempt in flight is aborted.
 *
 * `skip` is consulted lazily so that a failure which rules out a whole model or
 * a whole key takes the trials it invalidates out of the running immediately.
 */
function runHedged(trials, attempt, { skip, hedgeMs, maxAttempts }) {
  return new Promise((resolve, reject) => {
    const controllers = new Set();
    let nextIndex = 0;
    let running = 0;
    let settled = false;
    let hedgeTimer = null;

    const start = () => {
      if (settled || running >= maxAttempts) return;

      let trial = null;
      while (nextIndex < trials.length) {
        const candidate = trials[nextIndex++];
        if (!skip(candidate)) { trial = candidate; break; }
      }
      if (!trial) {
        if (running === 0 && !settled) { settled = true; clearTimeout(hedgeTimer); reject(null); }
        return;
      }

      const controller = new AbortController();
      controllers.add(controller);
      running++;

      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(start, hedgeMs);

      attempt(trial, controller.signal).then(
        value => {
          if (settled) return;
          settled = true;
          clearTimeout(hedgeTimer);
          for (const other of controllers) {
            if (other !== controller) other.abort();
          }
          resolve({ value, trial });
        },
        () => {
          controllers.delete(controller);
          running--;
          if (settled) return;
          start(); // a slot just opened — take the next trial now, don't wait out the hedge
          if (running === 0 && nextIndex >= trials.length && !settled) {
            settled = true;
            clearTimeout(hedgeTimer);
            reject(null);
          }
        }
      );
    };

    start();
  });
}

/**
 * Drive `execute` across the model/key trials, skipping anything already known
 * to be blacklisted or cooling down, and recording whatever fails on the way.
 */
async function runTrials(trials, execute, { claimed } = {}) {
  await loadRuntime();

  const deadModels = new Set();
  const deadKeys = new Set();
  const failures = [];

  const skip = (trial) =>
    claimed?.() === true || // an attempt is already producing output; don't spend another key
    deadModels.has(trial.model) ||
    deadKeys.has(trial.keyId) ||
    runtime.badModels.has(trial.trialId) ||
    Date.now() < (runtime.cooldowns[trial.trialId] || 0);

  const attempt = async (trial, signal) => {
    try {
      return await execute(trial, signal);
    } catch (error) {
      // A trial that lost the race or was cancelled says nothing about the
      // model or the key, so it must not leave a cooldown behind.
      if (error?.superseded || signal.aborted) throw error;
      recordFailure(trial, error, { trials, deadModels, deadKeys });
      failures.push(error);
      throw error;
    }
  };

  try {
    const { value, trial } = await runHedged(trials, attempt, {
      skip,
      hedgeMs: HEDGE_DELAY_MS,
      maxAttempts: MAX_HEDGED_ATTEMPTS
    });
    noteSuccess(trial);
    return value;
  } catch (_) {
    throw exhaustedError(trials, failures);
  }
}

function exhaustedError(trials, failures) {
  const now = Date.now();
  const cooling = {};
  for (const trial of trials) {
    const expiresAt = runtime.cooldowns[trial.trialId] || 0;
    if (expiresAt > now) cooling[trial.trialId] = expiresAt;
  }

  if (Object.keys(cooling).length > 0) {
    return new Error(`All available AI models and API keys are rate-limited. Please retry in ~${getShortestWait(cooling)}s.`);
  }
  const last = failures[failures.length - 1];
  const reason = last ? (last.apiMessage || last.message) : 'No available AI models or keys.';
  return new Error(`AI request failed: ${reason}`);
}

/** Resolve the trials to try for a request, cheapest-to-answer first. */
async function planTrials(options) {
  const keys = await getStoredKeys();
  if (keys.length === 0) {
    throw new Error('No Gemini API keys are configured. Please add an API key in the Settings tab.');
  }
  const preferredModel = await cachedGet('model', () => getStored('spelt_gemini_model').then(v => v || GEMINI_AUTO_MODEL));
  const modelTiers = await getAvailableModelTiers(preferredModel, options.preferFlash !== false);
  return getTrialSequence(modelTiers, keys);
}

/**
 * Send a prompt and return the parsed response text.
 * Falls through the model/key trials, hedging across keys on the way.
 */
async function generate(prompt, options, wantJson) {
  const trials = await planTrials(options);
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  const generationConfig = buildGenerationConfig(options);
  if (generationConfig) body.generationConfig = generationConfig;

  return withSlot(() => runTrials(trials, async (trial, signal) => {
    const response = await requestOnce(trial, body, wantJson, signal);
    const data = await response.json();
    const text = extractCandidateText(data.candidates?.[0]);
    if (!text) throw new Error('Invalid empty response from Gemini API.');
    return text.trim();
  }));
}

/**
 * Build generationConfig from caller options.
 *
 * Gemini 2.5+ models reason before answering by default. For the short,
 * well-specified prompts this extension sends (a mnemonic, a one-line
 * correction) that thinking pass adds latency and burns output tokens without
 * improving the answer, so callers can opt out with `thinking: false`.
 * Models that predate thinking ignore the field.
 */
function buildGenerationConfig(options = {}) {
  const config = {};
  // A ceiling even when the caller gives none: an unbounded reply is one the
  // user waits on for no reason. Every prompt here wants well under this.
  config.maxOutputTokens = options.maxOutputTokens || 2048;
  if (options.temperature !== undefined) config.temperature = options.temperature;
  // Off unless a caller explicitly asks for it. Every prompt this extension
  // sends is a short, fully specified task — a dictionary entry, a mnemonic,
  // a one-line correction — and the thinking pass only delays the answer.
  if (options.thinking !== true) config.thinkingConfig = { thinkingBudget: 0 };
  return config;
}

function extractCandidateText(candidate) {
  if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
    return '';
  }
  return candidate.content.parts
    .map(p => (p && typeof p.text === 'string') ? p.text : '')
    .join('');
}

/**
 * Sends a prompt to Google Gemini API and returns the parsed JSON response.
 * Requires Gemini API keys to be set in chrome.storage.local.
 * Automatically falls back through model/key trials on rate limit.
 */
export async function askGemini(prompt, options = {}) {
  let text = await generate(prompt, options, true /* wantJson */);

  // Clean text in case model returned markdown code blocks (e.g. ```json ... ```)
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
    throw new Error('Gemini response was not valid JSON. Please try again.', { cause: err });
  }
}

/**
 * Sends a prompt to Gemini and returns raw text (not JSON).
 * Used for free-form responses like hints, mnemonics, and feedback.
 * Automatically falls back through model/key trials on rate limit.
 */
export async function askGeminiText(prompt, options = {}) {
  return generate(prompt, options, false /* wantJson */);
}

/**
 * Streaming variant — sends text chunks to onChunk(accumulatedText) as they arrive.
 * Falls back through model tiers on error, same as askGeminiText.
 */
export async function askGeminiTextStream(prompt, options = {}, onChunk) {
  const trials = await planTrials(options);
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  const generationConfig = buildGenerationConfig(options);
  if (generationConfig) body.generationConfig = generationConfig;

  // Hedged attempts stream concurrently, so the first one to produce text claims
  // the callback. Without this the loser's tokens would interleave into the same
  // element and the panel would render two answers spliced together.
  const race = { winner: null };

  return withSlot(() => runTrials(trials, async (trial, signal) => {
    const response = await requestOnce(trial, body, false, signal, { stream: true });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const abortOnLoss = linkAbort(signal, { abort: () => reader.cancel().catch(() => {}) });
    let fullText = '';
    let buffer = '';

    const emit = (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return;
      const jsonStr = trimmed.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') return;

      let text;
      try {
        text = extractCandidateText(JSON.parse(jsonStr).candidates?.[0]);
      } catch (_) { return; /* skip malformed chunk */ }
      if (!text) return;

      if (race.winner === null) race.winner = trial.trialId;
      if (race.winner !== trial.trialId) {
        const lost = new Error('Superseded by a faster key.');
        lost.superseded = true;
        throw lost;
      }

      fullText += text;
      onChunk?.(fullText);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) emit(line);
      }

      // Flush remaining stream bytes and buffer lines
      buffer += decoder.decode();
      for (const line of buffer.split('\n')) emit(line);
    } finally {
      abortOnLoss();
    }

    const streamed = fullText.trim();
    if (!streamed) {
      // A 200 that yielded no usable chunk is a failed trial, not an answer.
      // Throwing lets the runner try the next model and, failing that, lets the
      // caller fall back to a non-streaming request instead of rendering ''.
      throw new Error('Stream returned no content.');
    }
    return streamed;
  }, { claimed: () => race.winner !== null }));
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

export function collectModelsFromKeyMap(keyModelsMap, keys, fallbackModels = []) {
  const models = [];
  (keys || []).forEach(key => {
    const keyModels = (keyModelsMap || {})[getGeminiKeyFingerprint(key)] || [];
    models.push(...keyModels);
  });
  if (models.length === 0) models.push(...fallbackModels);
  return sortGeminiModels(models);
}
