const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let mockDb = {}; // memory fallback for Node environment

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
      } catch (_) {
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
      } catch (_) {}
      mockDb[key] = value;
      resolve();
    }
  });
}

export async function getWords() {
  const words = await getStored('spelt_words');
  if (!Array.isArray(words)) return [];

  let modified = false;
  const sanitized = words.map(w => {
    if (!w) return w;
    let cardModified = false;

    if (w.rep === undefined || w.rep === null || isNaN(w.rep)) {
      w.rep = 0; cardModified = true;
    }
    if (w.interval === undefined || w.interval === null || isNaN(w.interval)) {
      w.interval = 0; cardModified = true;
    }
    if (w.ef === undefined || w.ef === null || isNaN(w.ef) || w.ef < 1.3) {
      w.ef = 2.5; cardModified = true;
    }
    if (w.nextDate === undefined || w.nextDate === null || isNaN(w.nextDate)) {
      w.nextDate = Date.now(); cardModified = true;
    }

    if (cardModified) modified = true;
    return w;
  });

  if (modified) {
    await saveWords(sanitized);
  }

  return sanitized;
}

export async function saveWords(words) {
  await setStored('spelt_words', words);
}

export async function resetDb() {
  await setStored('spelt_words', []);
  await setStored('spelt_activity', {});
  await setStored('spelt_streak', { current: 0, lastDate: '', max: 0 });
}

export async function logDebug(data) {
  try {
    await fetch('http://localhost:8081/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (_) {}
}
