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
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : mockDb[key];
  } catch (_) {
    return mockDb[key];
  }
}

async function setStored(key, value) {
  if (isExt) {
    await chrome.storage.local.set({ [key]: value });
  } else {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
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
      if (q === 3) interval = 1;
      else if (q === 4) interval = 6;
      else if (q === 5) interval = 12;
      else interval = 1;
    } else if (rep === 1 && prevInt === 1) {
      if (q === 3) interval = 3;
      else if (q === 4) interval = 6;
      else if (q === 5) interval = 12;
      else interval = 6;
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

// Helper to fetch translation from Google Translate API for highly accurate and reponsive single-word translation
export async function fetchTranslation(word, targetLang) {
  if (!targetLang || targetLang === 'none') return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0].trim();
      }
    }
  } catch (err) {
    console.error('Translation error:', err);
  }
  return '';
}
// Translate a word using the user's preferred target language
export async function translateWord(word) {
  const targetLang = await getStored('spelt_target_lang');
  if (!targetLang || targetLang === 'none') {
    throw new Error('Please configure a preferred language in Settings.');
  }
  return await fetchTranslation(word, targetLang);
}
// Add a single word
export async function addWord(wordData) {
  const list = await getWords();
  const normalizedWord = wordData.word.trim();
  
  if (list.some(w => w.word.toLowerCase() === normalizedWord.toLowerCase())) {
    throw new Error('Word already exists in library');
  }

  let translation = wordData.translation?.trim() || '';
  if (!translation) {
    const targetLang = await getStored('spelt_target_lang');
    if (targetLang && targetLang !== 'none') {
      translation = await fetchTranslation(normalizedWord, targetLang);
    }
  }

  const partOfSpeechVal = wordData.partOfSpeech?.trim() || '';
  const exampleVal = wordData.example?.trim() || await fetchDynamicExample(normalizedWord) || getFallbackExample(normalizedWord, partOfSpeechVal);

  const newWord = {
    id: 'w_' + Math.random().toString(36).substr(2, 9),
    word: normalizedWord,
    definition: wordData.definition?.trim() || '',
    transcription: wordData.transcription?.trim() || '',
    partOfSpeech: partOfSpeechVal,
    translation: translation,
    example: exampleVal,
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

    if (!wordObj.translation?.trim()) {
      const targetLang = await getStored('spelt_target_lang');
      if (targetLang && targetLang !== 'none') {
        const tr = await fetchTranslation(correctWord, targetLang);
        if (tr) wordObj.translation = tr;
      }
    }

    if (details.partOfSpeech && !wordObj.partOfSpeech) {
      wordObj.partOfSpeech = details.partOfSpeech;
    }

    if (!wordObj.example?.trim()) {
      wordObj.example = details.example?.trim() || await fetchDynamicExample(correctWord) || getFallbackExample(correctWord, wordObj.partOfSpeech || details.partOfSpeech || '');
    }

    await saveWords(list);
    return wordObj;
  } else {
    return await addWord({
      word: correctWord,
      definition: details.definition,
      transcription: details.transcription,
      partOfSpeech: details.partOfSpeech,
      example: details.example,
      translation: details.translation,
      misspellings: wrongSpelling ? [wrongSpelling] : []
    });
  }
}

// Update word SRS parameters based on review score
export async function reviewWord(wordId, q, typedWrongWord = null) {
  const list = await getWords();
  const index = list.findIndex(w => w.id === wordId);
  if (index === -1) throw new Error('Word not found');

  const card = list[index];
  const { rep, interval, ef, nextDate } = calcSM2(q, card.rep, card.interval, card.ef, 1.0);

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

// Delete a single word by its ID
export async function deleteWord(wordId) {
  const list = await getWords();
  const filtered = list.filter(w => w.id !== wordId);
  await saveWords(filtered);
}

// Play high-quality human audio pronunciation with fallback
export async function playWordAudio(word, accent) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const cleanWord = word.trim().toLowerCase();
  const suffix = accent === 'uk' ? 'gb' : 'us';
  const primaryUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanWord)}--_${suffix}_1.mp3`;

  try {
    const audio = new Audio(primaryUrl);
    await audio.play();
    return;
  } catch (e) {
    console.log('Google static audio failed, trying API dictionary fallback...');
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && data[0].phonetics) {
        const audios = data[0].phonetics.map(p => p.audio).filter(Boolean);
        const accentMatch = audios.find(a => a.includes(`-${accent}`) || a.includes(`/${accent}/`));
        const fallbackAudio = accentMatch || audios[0];
        if (fallbackAudio) {
          const audio = new Audio(fallbackAudio);
          await audio.play();
          return;
        }
      }
    }
  } catch (e) {
    console.log('Dictionary API fallback failed, using TTS...');
  }

  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

// Utility to clear everything
export async function resetDb() {
  await setStored('spelt_words', []);
  await setStored('spelt_activity', {});
  await setStored('spelt_streak', { current: 0, lastDate: '' });
}

// Fetch a real English sentence example dynamically from Tatoeba API
export async function fetchDynamicExample(word) {
  try {
    const url = `https://tatoeba.org/en/api_v0/search?from=eng&to=eng&query=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const wordLower = word.toLowerCase();
        const matches = data.results.filter(r => 
          r.lang === 'eng' && 
          r.text.toLowerCase().includes(wordLower)
        );
        if (matches.length > 0) {
          // Sort by sentence length to select the most concise and clean example first
          matches.sort((a, b) => a.text.length - b.text.length);
          return matches[0].text;
        }
      }
    }
  } catch (err) {
    console.error('Tatoeba example fetch error:', err);
  }
  return '';
}

// Dynamic fallback example sentence generator for context clues (handles abstract nouns and reponsive academic phrasing)
export function getFallbackExample(word, partOfSpeech = '') {
  const cleanWord = word.trim();
  const pos = partOfSpeech.trim().toLowerCase();
  if (pos.includes('noun')) {
    return `Their discussion focused on the role of ${cleanWord} in modern society.`;
  } else if (pos.includes('verb')) {
    return `We must find a way to ${cleanWord} under these difficult circumstances.`;
  } else if (pos.includes('adjective') || pos.includes('adj')) {
    return `We need to take a ${cleanWord} approach to solve this problem.`;
  } else if (pos.includes('adverb') || pos.includes('adv')) {
    return `The team worked ${cleanWord} to complete the project on time.`;
  } else {
    return `Could you please use the word ${cleanWord} in a proper sentence?`;
  }
}

// Censor the word (including its inflections) in the example sentence
export function censorWordInExample(word, example) {
  if (!example) return '';
  const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  let pattern = escapedWord;
  if (word.endsWith('e') && word.length > 2) {
    pattern = escapedWord.slice(0, -1) + '(?:e)?';
  }
  let regex;
  if (word.length >= 4) {
    regex = new RegExp('\\b' + pattern + '[a-z]*\\b', 'gi');
  } else {
    regex = new RegExp('\\b' + pattern + '(?:s|es|ed|ing|d|r|er|est|ly|y|ies|ied|ier|iest)?\\b', 'gi');
  }
  return example.replace(regex, '__________');
}
