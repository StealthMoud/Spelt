import { runSchemaMigrations } from './migrations.js';

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let mockDb = {};

export function triggerNetworkError() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('network-error'));
  }
}

export function triggerNetworkSuccess() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('network-success'));
  }
}

export function getStored(key) {
  return new Promise((resolve, reject) => {
    if (isExt) {
      chrome.storage.local.get(key, (res) => {
        if (chrome.runtime?.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(res ? res[key] : undefined);
      });
    } else {
      try {
        const stored = localStorage.getItem(key);
        resolve(stored ? JSON.parse(stored) : mockDb[key]);
      } catch {
        resolve(mockDb[key]);
      }
    }
  });
}

export function setStored(key, value) {
  return new Promise((resolve, reject) => {
    if (isExt) {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime?.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve();
      });
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {
        // Fallback for storage quota or restricted environment
      }
      mockDb[key] = value;
      resolve();
    }
  });
}

export async function getWordsRaw() {
  const words = await getStored('spelt_words');
  return Array.isArray(words) ? words : [];
}

export async function getWords() {
  const words = await getWordsRaw();
  return await runSchemaMigrations(words);
}

export async function saveWords(words) {
  await setStored('spelt_words', words);
}

let isWriting = false;
const writeQueue = [];

async function withWordWriteLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('spelt_words_write', task);
  }
  return task();
}

async function processWriteQueue() {
  if (isWriting) return;
  isWriting = true;
  while (writeQueue.length > 0) {
    const { updater, resolve, reject } = writeQueue.shift();
    try {
      const words = await withWordWriteLock(async () => {
        const currentWords = await getWordsRaw();
        await updater(currentWords);
        await saveWords(currentWords);
        return currentWords;
      });
      resolve(words);
    } catch (err) {
      reject(err);
    }
  }
  isWriting = false;
}

export function atomicUpdate(updater) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ updater, resolve, reject });
    processWriteQueue();
  });
}

export async function resetDb() {
  const reset = async () => {
    await atomicUpdate(async words => words.splice(0, words.length));
    await Promise.all([
      setStored('spelt_activity', {}),
      setStored('spelt_streak', { current: 0, lastDate: '', max: 0 }),
      setStored('spelt_sessions', []),
      setStored('spelt_sandbox_activity', {}),
      setStored('spelt_stats_ai_insights', null),
      setStored('spelt_stats_ai_insights_hash', ''),
      setStored('spelt_stats_ai_insights_timestamp', 0),
      setStored('spelt_ai_job', null),
      setStored('spelt_schema_version', 0)
    ]);
  };
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request('spelt_ai_job_write', reset);
  } else {
    await reset();
  }
}
