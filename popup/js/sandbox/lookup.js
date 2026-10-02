import { getWords, fetchDynamicDefinition } from '../../../shared/storage.js';

const cacheKey = 'spelt_lookup_cache_v1';
const maxAge = 7 * 24 * 60 * 60 * 1000;
let cacheWrite = Promise.resolve();

function asEntry(word, definition, transcription = '', partOfSpeech = '', example = '') {
  return { word, phonetics: transcription ? [{ text: transcription }] : [], meanings: [{ partOfSpeech, definitions: [{ definition, example }] }] };
}

export async function lookupDefinition(word) {
  const [words, stored] = await Promise.all([
    getWords(), chrome.storage.local.get(cacheKey).catch(() => ({}))
  ]);
  const saved = words.find(item => item.word.toLowerCase() === word && item.definition && item.definition !== 'No definition found');
  if (saved) return { data: [asEntry(word, saved.definition, saved.transcription, saved.partOfSpeech, saved.example)], unavailable: false };
  const cached = stored[cacheKey]?.[word];
  if (cached && Date.now() - cached.time < maxAge) return { data: [cached.entry], unavailable: false };

  let unavailable = true;
  const primary = (async () => {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      unavailable = response.status !== 404;
      throw new Error('Primary dictionary unavailable');
    }
    const data = await response.json();
    if (!data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition || !Array.isArray(data[0].phonetics)) {
      unavailable = true;
      throw new Error('Invalid dictionary response');
    }
    return data[0];
  })();
  const secondary = fetchDynamicDefinition(word).then(result => {
    if (!result.definition) throw new Error('No secondary definition');
    return asEntry(word, result.definition);
  });
  try {
    const entry = await Promise.any([primary, secondary]);
    // Serialize writes so overlapping searches cannot drop a cached result.
    cacheWrite = cacheWrite.catch(() => {}).then(async () => {
      const latest = await chrome.storage.local.get(cacheKey);
      const entries = { ...latest[cacheKey], [word]: { entry, time: Date.now() } };
      const bounded = Object.fromEntries(Object.entries(entries).sort((a, b) => b[1].time - a[1].time).slice(0, 200));
      await chrome.storage.local.set({ [cacheKey]: bounded });
    });
    void cacheWrite.catch(() => {});
    return { data: [entry], unavailable: false };
  } catch {
    return { data: null, unavailable };
  }
}
