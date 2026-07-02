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

  const migrated = await getStored('spelt_migrated_to_spelling_v3');
  const runMigration = !migrated;

  const migratedRecall = await getStored('spelt_migrated_meaning_to_recall');
  const runMigrationRecall = !migratedRecall;

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
    // Parse nextDate if it is a string or Date object
    if (w.nextDate !== undefined && w.nextDate !== null) {
      if (typeof w.nextDate === 'string') {
        const num = Number(w.nextDate);
        if (!isNaN(num)) {
          w.nextDate = num;
          cardModified = true;
        } else {
          const parsed = Date.parse(w.nextDate);
          if (!isNaN(parsed)) { w.nextDate = parsed; cardModified = true; }
        }
      } else if (w.nextDate instanceof Date) {
        w.nextDate = w.nextDate.getTime();
        cardModified = true;
      } else if (typeof w.nextDate === 'object' && w.nextDate.getTime) {
        w.nextDate = w.nextDate.getTime();
        cardModified = true;
      }
    }

    // Parse meaningNextDate if it is a string or Date object
    if (w.meaningNextDate !== undefined && w.meaningNextDate !== null) {
      if (typeof w.meaningNextDate === 'string') {
        const num = Number(w.meaningNextDate);
        if (!isNaN(num)) {
          w.meaningNextDate = num;
          cardModified = true;
        } else {
          const parsed = Date.parse(w.meaningNextDate);
          if (!isNaN(parsed)) { w.meaningNextDate = parsed; cardModified = true; }
        }
      } else if (w.meaningNextDate instanceof Date) {
        w.meaningNextDate = w.meaningNextDate.getTime();
        cardModified = true;
      } else if (typeof w.meaningNextDate === 'object' && w.meaningNextDate.getTime) {
        w.meaningNextDate = w.meaningNextDate.getTime();
        cardModified = true;
      }
    }

    // Recover nextDate/meaningNextDate from review history if they should be in the future
    if (Array.isArray(w.history) && w.history.length > 0) {
      const lastSpelling = [...w.history].reverse().find(h => h.mode === 'spelling');
      if (lastSpelling && lastSpelling.date && lastSpelling.interval !== undefined) {
        const intervalNum = Number(lastSpelling.interval);
        const dateNum = typeof lastSpelling.date === 'string' ? Date.parse(lastSpelling.date) : Number(lastSpelling.date);
        if (!isNaN(intervalNum) && !isNaN(dateNum)) {
          const isFailed = lastSpelling.q !== undefined && Number(lastSpelling.q) < 3;
          const expectedNext = isFailed ? dateNum : dateNum + intervalNum * 24 * 60 * 60 * 1000;
          if (expectedNext > Date.now() && (w.nextDate === undefined || w.nextDate === null || isNaN(w.nextDate))) {
            w.nextDate = expectedNext;
            cardModified = true;
          }
        }
      }

      const lastMeaning = [...w.history].reverse().find(h => h.mode === 'meaning');
      if (lastMeaning && lastMeaning.date && lastMeaning.interval !== undefined) {
        const intervalNum = Number(lastMeaning.interval);
        const dateNum = typeof lastMeaning.date === 'string' ? Date.parse(lastMeaning.date) : Number(lastMeaning.date);
        if (!isNaN(intervalNum) && !isNaN(dateNum)) {
          const isFailed = lastMeaning.q !== undefined && Number(lastMeaning.q) < 3;
          const expectedNext = isFailed ? dateNum : dateNum + intervalNum * 24 * 60 * 60 * 1000;
          if (expectedNext > Date.now() && (w.meaningNextDate === undefined || w.meaningNextDate === null || isNaN(w.meaningNextDate))) {
            w.meaningNextDate = expectedNext;
            cardModified = true;
          }
        }
      }
    }

    if (w.nextDate === undefined || w.nextDate === null || isNaN(w.nextDate)) {
      w.nextDate = Date.now(); cardModified = true;
    }

    if (w.meaningRep === undefined || w.meaningRep === null || isNaN(w.meaningRep)) {
      w.meaningRep = 0; cardModified = true;
    }
    if (w.meaningInterval === undefined || w.meaningInterval === null || isNaN(w.meaningInterval)) {
      w.meaningInterval = 0; cardModified = true;
    }
    if (w.meaningEf === undefined || w.meaningEf === null || isNaN(w.meaningEf) || w.meaningEf < 1.3) {
      w.meaningEf = 2.5; cardModified = true;
    }
    if (w.meaningNextDate === undefined || w.meaningNextDate === null || isNaN(w.meaningNextDate)) {
      w.meaningNextDate = Date.now(); cardModified = true;
    }

    if (!w.practiceType) {
      w.practiceType = 'spelling'; cardModified = true;
    }

    if (runMigration && w.practiceType === 'both') {
      w.practiceType = 'spelling'; cardModified = true;
    }

    if (runMigrationRecall && w.practiceType === 'meaning') {
      w.practiceType = 'recall'; cardModified = true;
    }

    if (cardModified) modified = true;
    return w;
  });

  if (runMigration) {
    await setStored('spelt_migrated_to_spelling_v3', true);
    modified = true;
  }

  if (runMigrationRecall) {
    await setStored('spelt_migrated_meaning_to_recall', true);
    modified = true;
  }

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
