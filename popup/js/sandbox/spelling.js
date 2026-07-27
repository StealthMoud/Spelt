import { getWords, fetchCambridgePronunciation, fetchDynamicDefinition, getSpellingVariant } from '../../../shared/storage.js';
import { getLevenshtein, isValidSuggestion } from '../../../src/core/spelling.js';

export { getLevenshtein, isValidSuggestion };

export const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'recieve': 'receive', 'goverment': 'government', 'enviroment': 'environment',
  'pronounciation': 'pronunciation', 'calender': 'calendar'
};
export const commonWords = ["accommodate", "definitely", "separate", "receive", "embarrass", "until", "government", "environment", "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing", "colleague", "successful", "tomorrow"];



export async function isWordSpellingValid(word) {
  const lower = word.toLowerCase();
  try {
    const vaultWords = await getWords();
    if (vaultWords.some(w => w.word.toLowerCase() === lower)) return true;
  } catch (_) {}
  
  if (Object.values(spellingMap).includes(lower)) return true;
  if (commonWords.includes(lower)) return true;
  
  // Check if the word is a known US/UK spelling variant
  if (getSpellingVariant(lower)) return true;
  
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lower)}`);
    if (res.ok) return true;
  } catch (_) {}
  
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(lower)}`;
    const res = await fetch(url);
    if (res.ok) {
      const finalUrl = res.url.toLowerCase();
      if (!finalUrl.endsWith('/english/') && !finalUrl.endsWith('/english')) {
        const cambridge = await fetchCambridgePronunciation(lower);
        if (cambridge.ukIpa || cambridge.usIpa || cambridge.level || cambridge.ukAudio) return true;
      }
    }
  } catch (_) {}
  
  return false;
}

export async function findSuggestions(word) {
  const lower = word.toLowerCase();
  if (spellingMap[lower]) return [spellingMap[lower]];
  const matches = [];
  try {
    const vaultWords = await getWords();
    for (const w of vaultWords) {
      const d = getLevenshtein(lower, w.word.toLowerCase());
      if (d < 3 && isValidSuggestion(lower, w.word, d)) matches.push({ word: w.word, dist: d });
    }
  } catch (_) {}
  try {
    const res = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(lower)}`);
    if (res.ok) {
      const data = await res.json();
      data.forEach(item => {
        const itemLower = item.word.toLowerCase();
        if (itemLower !== lower && !item.word.includes(' ')) {
          const d = getLevenshtein(lower, itemLower);
          if (d < 4 && isValidSuggestion(lower, item.word, d)) matches.push({ word: item.word, dist: d });
        }
      });
    }
  } catch (_) {}
  if (matches.length === 0) {
    commonWords.forEach(w => {
      const d = getLevenshtein(lower, w.toLowerCase());
      if (d < 3 && isValidSuggestion(lower, w, d)) matches.push({ word: w, dist: d });
    });
  }
  matches.sort((a, b) => a.dist - b.dist);
  const uniqueMatches = [...new Set(matches.map(m => m.word).filter(w => w.toLowerCase() !== lower))];
  const validSuggestions = [];
  for (const s of uniqueMatches) {
    if (await isWordSpellingValid(s)) {
      validSuggestions.push(s);
      if (validSuggestions.length >= 4) break;
    }
  }
  return validSuggestions;
}
