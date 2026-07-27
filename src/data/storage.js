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
  return new Promise((resolve) => {
    if (isExt) {
      chrome.storage.local.get(key, (res) => {
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
  return new Promise((resolve) => {
    if (isExt) {
      chrome.storage.local.set({ [key]: value }, () => {
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
  await setStored('spelt_words', []);
  await setStored('spelt_activity', {});
  await setStored('spelt_streak', { current: 0, lastDate: '', max: 0 });
  await setStored('spelt_schema_version', 0);
}
