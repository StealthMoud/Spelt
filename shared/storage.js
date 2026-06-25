// Database service wrapping chrome.storage.local or memory fallback
// Includes SRS calculation via SuperMemo-2 (SM-2) algorithm

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
let mockDb = {}; // memory fallback for Node environment

function triggerNetworkError() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('network-error'));
  }
}

function triggerNetworkSuccess() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('network-success'));
  }
}

// Helper to wrap storage calls in promise
export async function getStored(key) {
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

export async function setStored(key, value) {
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
export function calcSM2(q, prevRep, prevInt, prevEF, multiplier = 1.0, isCorrect = true) {
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
      // Scale interval growth based on card rating (prevents flat intervals when user reivews)
      let qualityMultiplier = 1.0;
      if (q === 3) qualityMultiplier = 0.6;      // Hard
      else if (q === 5) qualityMultiplier = 1.3; // Easy

      interval = Math.round(prevInt * ef * qualityMultiplier);

      // Keep progression strictly forward
      if (interval <= prevInt) {
        interval = prevInt + 1;
      }
    }

    // Penalty if spelled incorectly so they re-test sooner
    if (!isCorrect) {
      interval = Math.round(interval * 0.5);
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
      triggerNetworkSuccess();
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0].trim();
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Translation fetch failed:', err.message || err);
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
  let definitionVal = wordData.definition?.trim() || '';
  if (!definitionVal || definitionVal === 'No definition found') {
    definitionVal = await fetchDynamicDefinition(normalizedWord) || definitionVal;
  }
  const exampleVal = wordData.example?.trim() || await fetchDynamicExample(normalizedWord) || getFallbackExample(normalizedWord, partOfSpeechVal);

  const exampleTranslationVal = wordData.exampleTranslation?.trim() || '';

  let transcriptionVal = wordData.transcription?.trim() || '';
  let levelVal = wordData.level || '';
  if (!transcriptionVal || transcriptionVal === '/--/' || !levelVal) {
    try {
      const cambridge = await fetchCambridgePronunciation(normalizedWord);
      if (!transcriptionVal || transcriptionVal === '/--/') {
        if (cambridge.ukIpa && cambridge.usIpa) {
          transcriptionVal = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
        } else {
          transcriptionVal = cambridge.ukIpa || cambridge.usIpa || '';
        }
      }
      if (!levelVal) {
        levelVal = cambridge.level || '';
      }
    } catch (_) {}
  }

  const newWord = {
    id: 'w_' + Math.random().toString(36).substr(2, 9),
    word: normalizedWord,
    definition: definitionVal,
    transcription: transcriptionVal,
    partOfSpeech: partOfSpeechVal,
    translation: translation,
    example: exampleVal,
    exampleTranslation: exampleTranslationVal,
    tags: Array.isArray(wordData.tags) ? wordData.tags : [],
    notes: wordData.notes?.trim() || '',
    rep: 0,
    interval: 0,
    ef: 2.5,
    mastered: wordData.mastered || false,
    nextDate: wordData.nextDate !== undefined ? wordData.nextDate : Date.now(),
    createdAt: Date.now(),
    history: [],
    level: levelVal.toUpperCase().trim(),
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
    if (wrongSpelling && wrongSpelling.toLowerCase() !== correctWord.toLowerCase()) {
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
    if (details.level && !wordObj.level) {
      wordObj.level = details.level;
    }

    if (!wordObj.definition?.trim() || wordObj.definition === 'No definition found') {
      const dynamicDef = details.definition?.trim() || await fetchDynamicDefinition(correctWord);
      if (dynamicDef) wordObj.definition = dynamicDef;
    }

    if (!wordObj.example?.trim() || isFallbackExample(correctWord, wordObj.example)) {
      const dynamicEx = details.example?.trim() || await fetchDynamicExample(correctWord);
      if (dynamicEx) {
        wordObj.example = dynamicEx;
      } else if (!wordObj.example) {
        wordObj.example = getFallbackExample(correctWord, wordObj.partOfSpeech || details.partOfSpeech || '');
      }
    }

    if (details.example && details.example !== wordObj.example) {
      wordObj.example = details.example;
      wordObj.exampleTranslation = details.exampleTranslation || '';
    } else {
      if (details.exampleTranslation && !wordObj.exampleTranslation) {
        wordObj.exampleTranslation = details.exampleTranslation;
      }
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
      level: details.level,
      misspellings: wrongSpelling ? [wrongSpelling] : []
    });
  }
}

// Update word SRS parameters based on review score
// responseTimeMs: optional ms elapsed from card shown to rating submitted
export async function reviewWord(wordId, q, typedWrongWord = null, responseTimeMs = null) {
  const list = await getWords();
  const index = list.findIndex(w => w.id === wordId);
  if (index === -1) throw new Error('Word not found');

  const card = list[index];
  const isCorrect = (typedWrongWord === null || typedWrongWord === undefined);
  const { rep, interval, ef, nextDate } = calcSM2(q, card.rep, card.interval, card.ef, 1.0, isCorrect);

  card.rep = rep;
  card.interval = interval;
  card.ef = ef;
  card.nextDate = nextDate;
  card.lastReviewedAt = Date.now();
  const historyEntry = { date: Date.now(), q, interval };
  if (responseTimeMs !== null && responseTimeMs > 0) {
    historyEntry.rt = responseTimeMs;
  }
  card.history.push(historyEntry);

  if (typedWrongWord !== null && typedWrongWord !== undefined) {
    if (!card.misspellings) card.misspellings = [];
    if (typedWrongWord.toLowerCase() !== card.word.toLowerCase()) {
      card.misspellings.push(typedWrongWord);
    }
  } else {
    // reset missspellings since they spelled it right in practice
    card.misspellings = [];
  }

  await saveWords(list);
  await logActivity();
  return card;
}

// Get YYYY-MM-DD date string in local timezone
export function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Track study streaks and daily activity
async function logActivity() {
  const activity = await getStored('spelt_activity') || {};
  const today = getLocalDateString();
  activity[today] = (activity[today] || 0) + 1;
  await setStored('spelt_activity', activity);
  await updateStreak(today);
}

// Recalculate streak based on days consecutive
async function updateStreak(todayStr) {
  const streak = await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else if (streak.lastDate !== todayStr) {
    streak.current = 1;
  }
  streak.lastDate = todayStr;
  
  if (!streak.max) {
    streak.max = streak.current;
  }
  if (streak.current > streak.max) {
    streak.max = streak.current;
  }
  
  await setStored('spelt_streak', streak);
}

// Export streak values for statistics
export async function getStreak() {
  return await getStored('spelt_streak') || { current: 0, lastDate: '', max: 0 };
}

// Export daily activity data for heatmap and analytics
export async function getActivity() {
  return await getStored('spelt_activity') || {};
}

// Log sandbox spelling-check activity for analytics
export async function logSandboxActivity(result) {
  const data = await getStored('spelt_sandbox_activity') || {};
  const today = getLocalDateString();
  if (!data[today]) data[today] = { checks: 0, correct: 0, misspelled: 0, notFound: 0 };
  data[today].checks++;
  if (result === 'correct') data[today].correct++;
  else if (result === 'misspelled') data[today].misspelled++;
  else if (result === 'not_found') data[today].notFound++;
  await setStored('spelt_sandbox_activity', data);
}

// Read sandbox activity data for stats
export async function getSandboxActivity() {
  return await getStored('spelt_sandbox_activity') || {};
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

  // 1. Try Cambridge Dictionary audio first
  try {
    const cambridge = await fetchCambridgePronunciation(cleanWord);
    const cambridgeUrl = accent === 'uk' ? cambridge.ukAudio : cambridge.usAudio;
    if (cambridgeUrl) {
      // Fetch the audio file as a Blob to bypass Chrome Extension CORS limitations on cross-origin media sources
      const response = await fetch(cambridgeUrl);
      if (response.ok) {
        triggerNetworkSuccess();
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        await audio.play();
        return;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge pronunciation play failed, trying static fallback...');
  }

  const suffix = accent === 'uk' ? 'gb' : 'us';
  const primaryUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanWord)}--_${suffix}_1.mp3`;

  try {
    const audio = new Audio(primaryUrl);
    await audio.play();
    return;
  } catch (e) {
    console.info('Google static audio failed, trying API dictionary fallback...');
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (res.ok) {
      triggerNetworkSuccess();
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
    triggerNetworkError();
    console.info('Dictionary API fallback failed, using TTS...');
  }

  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

// Play full sentence using Web Speech API (speechSynthesis)
export function playSentenceAudio(sentence, accent) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence.trim());
  utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// Utility to clear everything
export async function resetDb() {
  await setStored('spelt_words', []);
  await setStored('spelt_activity', {});
  await setStored('spelt_streak', { current: 0, lastDate: '', max: 0 });
}

// Fetch a premium English definition dynamically from Cambridge or Oxford
export async function fetchDynamicDefinition(word) {
  const cleanWord = word.trim().toLowerCase();

  // 1. Try Cambridge Dictionary
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<div\s+class=\"def ddef_d[^>]*>([\s\S]*?)<\/div>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return text;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge definition fetch failed:', err.message || err);
  }

  // 2. Try Oxford Learner's Dictionary
  try {
    const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<span\s+class=\"def\"[^>]*>([\s\S]*?)<\/span>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return text;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Oxford definition fetch failed:', err.message || err);
  }

  return '';
}

// Fetch a real English sentence example dynamically from Cambridge, Oxford, or Tatoeba
export async function fetchDynamicExample(word) {
  const cleanWord = word.trim().toLowerCase();
  
  const pickBest = (list) => {
    const filtered = list.filter(s => {
      if (s.length < 20 || s.length > 150) return false;
      if (/[\[\]\(\)\/=\|]/.test(s)) return false;
      return true;
    });
    const target = filtered.length > 0 ? filtered : list;
    if (target.length === 0) return '';
    target.sort((a, b) => {
      const diffA = Math.abs(a.length - 60);
      const diffB = Math.abs(b.length - 60);
      return diffA - diffB;
    });
    return target[0];
  };

  // 1. Try Cambridge Dictionary
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<(div|span)\s+class=\"examp[^>]*>([\s\S]*?)<\/\1>/g;
      let match;
      const sentences = [];
      while (match = regex.exec(html)) {
        let text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text && text.toLowerCase().includes(cleanWord)) {
          text = text.replace(/^\[[^\]]+\]\s*/, '').trim();
          text = text.replace(/^(formal|informal|humorous|approving|disapproving|saying)\s+/i, '');
          sentences.push(text);
        }
      }
      const best = pickBest(sentences);
      if (best) return best;
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge example fetch failed:', err.message || err);
  }

  // 2. Try Oxford Learner's Dictionary
  try {
    const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<span\s+class=\"x\"[^>]*>([\s\S]*?)<\/span>/g;
      let match;
      const sentences = [];
      while (match = regex.exec(html)) {
        const text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text && text.toLowerCase().includes(cleanWord)) {
          sentences.push(text);
        }
      }
      const best = pickBest(sentences);
      if (best) return best;
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Oxford example fetch failed:', err.message || err);
  }

  // 3. Try Tatoeba API
  try {
    const url = `https://tatoeba.org/en/api_v0/search?from=eng&to=eng&query=${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url);
    if (res.ok) {
      triggerNetworkSuccess();
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const sentences = data.results
          .filter(r => r.lang === 'eng' && r.text.toLowerCase().includes(cleanWord))
          .map(r => r.text);
        const best = pickBest(sentences);
        if (best) return best;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Tatoeba example fetch error:', err.message || err);
  }

  return '';
}

// Check if the given example is a fallback template or an old hardcoded template sentence
export function isFallbackExample(word, example) {
  if (!example) return true;
  const cleanWord = word.trim().toLowerCase();
  const cleanEx = example.trim().toLowerCase();
  
  const oldHardcoded = [
    'the hotel can accommodate up to three hundred guests.',
    'we will definitely attend the conference next week.',
    'please separate the recycling from the general waste.',
    'did you receive the email i sent you yesterday?',
    'i did not mean to embarrass you in front of the team.',
    'we will wait here until the rain finally stops.',
    'the new government promised to lower taxes.',
    'we must do more to protect our natural environment.',
    'the accident occurred at the corner of the street.',
    'he paused on the threshold before entering the room.',
    'his pronunciation of the word was perfectly clear.',
    'she marked the meeting date on her wall calendar.',
    'it is necessary to wear a helmet when riding a bike.',
    'he is currently writing a novel about his travels.',
    'my colleague helped me finish the project on time.',
    'the launch of the new product was highly successful.',
    'we plan to start our journey early tomorrow morning.',
    'the children spent all day playing on the sandy beach.',
    'the test was very easy and everyone passed it.',
    'please try to spell the word again if you make a mistake.',
    'her perseverance in the face of multiple setbacks was truly inspiring.',
    'a civilized society is judged by how it treats its most vulnerable members.',
    'successful collaboration between the two teams led to a breakthrough.',
    'the research team conducted a detailed analysis of the data.',
    'there is a strong correlation between regular study and high test scores.',
    'the experiment provided validation for the scientist\'s theory.',
    'the teacher conducted an assessment of the students\' language skills.',
    'the new results show a significant improvement over the previous trials.'
  ];

  if (oldHardcoded.includes(cleanEx)) return true;

  const templates = [
    `their discussion focused on the role of ${cleanWord} in modern society.`,
    `we must find a way to ${cleanWord} under these difficult circumstances.`,
    `we need to take a ${cleanWord} approach to solve this problem.`,
    `the team worked ${cleanWord} to complete the project on time.`,
    `could you please use the word ${cleanWord} in a proper sentence?`,
    `the local guide showed us where to find the best ${cleanWord} in town.`,
    `they decided to ${cleanWord} the process to make it more efficient.`,
    `it was a ${cleanWord} moment that changed everything for us.`,
    `it was an ${cleanWord} moment that changed everything for us.`,
    `she completed the assignment ${cleanWord} before the deadline.`
  ];

  return templates.some(t => cleanEx === t);
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

// Log debug info to the local debug server
export async function logDebug(data) {
  try {
    await fetch('http://localhost:8081/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (_) {}
}

// Fetch accurate UK/US IPA transcriptions and MP3 URLs dynamically from Cambridge or Oxford Learner's Dictionary
export async function fetchCambridgePronunciation(word) {
  const cleanWord = word.trim().toLowerCase();
  let result = { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '' };
  
  // 1. Try Cambridge Dictionary first
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const ukRegex = /<span\s+class="uk dpron-i\s*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g;
      const ukMatch = ukRegex.exec(html);
      if (ukMatch) {
        const ukBlock = ukMatch[1];
        const audioMatch = /<source\s+type="audio\/mpeg"\s+src="([^"]+)"/i.exec(ukBlock);
        if (audioMatch) {
          result.ukAudio = 'https://dictionary.cambridge.org' + audioMatch[1];
        }
        const ipaRegex = /<span\s+class="ipa dipa[^>]*>([\s\S]*?)<\/span>\s*\//i;
        const ipaMatch = ipaRegex.exec(ukBlock);
        if (ipaMatch) {
          result.ukIpa = '/' + ipaMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() + '/';
        }
      }

      const usRegex = /<span\s+class="us dpron-i\s*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g;
      const usMatch = usRegex.exec(html);
      if (usMatch) {
        const usBlock = usMatch[1];
        const audioMatch = /<source\s+type="audio\/mpeg"\s+src="([^"]+)"/i.exec(usBlock);
        if (audioMatch) {
          result.usAudio = 'https://dictionary.cambridge.org' + audioMatch[1];
        }
        const ipaRegex = /<span\s+class="ipa dipa[^>]*>([\s\S]*?)<\/span>\s*\//i;
        const ipaMatch = ipaRegex.exec(usBlock);
        if (ipaMatch) {
          result.usIpa = '/' + ipaMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() + '/';
        }
        }
        
        // Extract CEFR level from Cambridge
        const levelRegex = /<span\s+class="[^"]*(?:epp-xref|level|cefr)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
        let m;
        while ((m = levelRegex.exec(html)) !== null) {
          const txt = m[1].replace(/<[^>]*>/g, '').trim().toUpperCase();
          if (/^[A-C][1-2]$/.test(txt)) {
            result.level = txt;
            break;
          }
        }
      }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge fetch failed:', err.message || err);
  }

  // 2. Fall back to Oxford Learner's Dictionary if Cambridge results are empty (due to 403 or other blocks)
  const hasAudio = result.ukAudio || result.usAudio;
  const hasIpa = result.ukIpa || result.usIpa;
  if (!hasAudio || !hasIpa) {
    try {
      const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        triggerNetworkSuccess();
        const html = await res.text();
        
        // Find UK Pronunciation Block
        const ukRegex = /class="[^"]*pron-uk[^"]*"[^>]*data-src-mp3="([^"]+)"[\s\S]*?<span\s+class="phon">([^<]+)<\/span>/i;
        const ukMatch = ukRegex.exec(html);
        if (ukMatch) {
          if (!result.ukAudio) result.ukAudio = ukMatch[1];
          if (!result.ukIpa) result.ukIpa = ukMatch[2].trim();
        }

        // Find US Pronunciation Block
        const usRegex = /class="[^"]*pron-us[^"]*"[^>]*data-src-mp3="([^"]+)"[\s\S]*?<span\s+class="phon">([^<]+)<\/span>/i;
        const usMatch = usRegex.exec(html);
        if (usMatch) {
          if (!result.usAudio) result.usAudio = usMatch[1];
          if (!result.usIpa) result.usIpa = usMatch[2].trim();
        }

        // Extract CEFR level from Oxford fallback
        if (!result.level) {
          const cefrRegex = /<span\s+class="cefr"[^>]*>([\s\S]*?)<\/span>/gi;
          let m;
          while ((m = cefrRegex.exec(html)) !== null) {
            const txt = m[1].replace(/<[^>]*>/g, '').trim().toUpperCase();
            if (/^[A-C][1-2]$/.test(txt)) {
              result.level = txt;
              break;
            }
          }
        }
        if (!result.level) {
          const oxRegex = /data-ox(?:3000|5000)="([a-c][1-2])"/i;
          const oxMatch = oxRegex.exec(html);
          if (oxMatch) {
            result.level = oxMatch[1].toUpperCase();
          }
        }
      }
    } catch (err) {
      triggerNetworkError();
      console.info('Oxford fallback fetch failed:', err.message || err);
    }
  }

  return result;
}

// Read continuous study session history
export async function getSessions() {
  return await getStored('spelt_sessions') || [];
}

// Log or update continuous study session
export async function logSession(sessionData) {
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.startTime === sessionData.startTime);
  if (idx !== -1) {
    sessions[idx] = sessionData;
  } else {
    sessions.push(sessionData);
  }
  
  // Cap at 200 sessions to avoid unbounded storage usage
  if (sessions.length > 200) {
    sessions.shift();
  }
  
  await setStored('spelt_sessions', sessions);
}


