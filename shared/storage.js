// Database service wrapping chrome.storage.local or memory fallback
// Includes SRS calculation via SuperMemo-2 (SM-2) algorithm

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let mockDb = {}; // memory fallback for Node environment

// Helper to wrap storage calls in promise
async function getStored(key) {
  if (isExt) {
    const res = await chrome.storage.local.get(key);
    return res[key];
  }
  return mockDb[key];
}

async function setStored(key, value) {
  if (isExt) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    mockDb[key] = value;
  }
}

// Compute SM-2 spaced repetition values
// quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
// multiplier scales the computed interval (0.5 = faster, 1.5 = slower)
export function calcSM2(q, prevRep, prevInt, prevEF, multiplier = 1.0) {
  let rep = prevRep;
  let interval = prevInt;
  let ef = prevEF;

  if (q < 3) {
    rep = 0;
    interval = 1; // reset
  } else {
    if (rep === 0) {
      interval = 1;
    } else if (rep === 1) {
      interval = 6;
    } else {
      interval = Math.round(prevInt * ef);
    }
    rep += 1;
  }

  // Apply spacing multiplier from user settings
  interval = Math.max(1, Math.round(interval * multiplier));

  // Adjust Ease Factor (EF)
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  // "Again" cards stay due immediately,
  // successful reviews get pushed forward by the computed interval
  const nextDate = q < 3
    ? Date.now()
    : Date.now() + interval * 24 * 60 * 60 * 1000;

  return { rep, interval, ef, nextDate };
}

// Load all words from database
export async function getWords() {
  const words = await getStored('spelt_words');
  return words || [];
}

// Save all words to database
export async function saveWords(words) {
  await setStored('spelt_words', words);
}

// Add a single word
export async function addWord(wordData) {
  const list = await getWords();
  const normalizedWord = wordData.word.trim();
  
  if (list.some(w => w.word.toLowerCase() === normalizedWord.toLowerCase())) {
    throw new Error('Word already exists in library');
  }

  const newWord = {
    id: 'w_' + Math.random().toString(36).substr(2, 9),
    word: normalizedWord,
    definition: wordData.definition?.trim() || '',
    transcription: wordData.transcription?.trim() || '',
    translation: wordData.translation?.trim() || '',
    example: wordData.example?.trim() || '',
    tags: Array.isArray(wordData.tags) ? wordData.tags : [],
    notes: wordData.notes?.trim() || '',
    rep: 0,
    interval: 0,
    ef: 2.5,
    mastered: wordData.mastered || false,
    nextDate: wordData.nextDate !== undefined ? wordData.nextDate : Date.now(),
    createdAt: Date.now(),
    history: [],
    misspellings: Array.isArray(wordData.misspellings) ? wordData.misspellings : []
  };

  list.push(newWord);
  await saveWords(list);
  await logActivity();
  return newWord;
}

// Register a misspelling event and force-enqueue card for SRS practice
export async function registerMisspelling(correctWord, wrongSpelling, details = {}) {
  const list = await getWords();
  const wordObj = list.find(w => w.word.toLowerCase() === correctWord.toLowerCase());
  if (wordObj) {
    if (!wordObj.misspellings) wordObj.misspellings = [];
    if (wrongSpelling && !wordObj.misspellings.includes(wrongSpelling) && wrongSpelling.toLowerCase() !== correctWord.toLowerCase()) {
      wordObj.misspellings.push(wrongSpelling);
    }
    wordObj.mastered = false; // re-enter SRS if previously mastered
    wordObj.rep = 0;
    wordObj.interval = 1;
    wordObj.nextDate = Date.now(); // due immediately for practice
    await saveWords(list);
    return wordObj;
  } else {
    return await addWord({
      word: correctWord,
      definition: details.definition,
      transcription: details.transcription,
      example: details.example,
      misspellings: wrongSpelling ? [wrongSpelling] : []
    });
  }
}

// Update word SRS parameters based on review score
export async function reviewWord(wordId, q, typedWrongWord = null) {
  const list = await getWords();
  const index = list.findIndex(w => w.id === wordId);
  if (index === -1) throw new Error('Word not found');

  // Read user's spacing multiplier setting (defaults to 1.0)
  let multiplier = 1.0;
  try {
    const stored = await getStored('spelt_srs_multiplier');
    if (stored && !isNaN(stored)) multiplier = parseFloat(stored);
  } catch (_) { /* fallback to 1.0 */ }

  const card = list[index];
  const { rep, interval, ef, nextDate } = calcSM2(q, card.rep, card.interval, card.ef, multiplier);

  card.rep = rep;
  card.interval = interval;
  card.ef = ef;
  card.nextDate = nextDate;
  card.lastReviewedAt = Date.now();
  card.history.push({ date: Date.now(), q, interval });

  if (typedWrongWord) {
    if (!card.misspellings) card.misspellings = [];
    if (!card.misspellings.includes(typedWrongWord) && typedWrongWord.toLowerCase() !== card.word.toLowerCase()) {
      card.misspellings.push(typedWrongWord);
    }
  }

  await saveWords(list);
  await logActivity();
  return card;
}

// Track study streaks and daily activity
async function logActivity() {
  const activity = await getStored('spelt_activity') || {};
  const today = new Date().toISOString().split('T')[0];
  activity[today] = (activity[today] || 0) + 1;
  await setStored('spelt_activity', activity);
  await updateStreak(today);
}

// Recalculate streak based on days consecutive
async function updateStreak(todayStr) {
  const streak = await getStored('spelt_streak') || { current: 0, lastDate: '' };
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else if (streak.lastDate !== todayStr) {
    streak.current = 1;
  }
  streak.lastDate = todayStr;
  await setStored('spelt_streak', streak);
}

// Utility to clear everything
export async function resetDb() {
  await setStored('spelt_words', []);
  await setStored('spelt_activity', {});
  await setStored('spelt_streak', { current: 0, lastDate: '' });
}
