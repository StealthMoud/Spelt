import { getWords, saveWords, fetchTranslation, fetchDynamicExample, isFallbackExample, getFallbackExample, logDebug, fetchDynamicDefinition } from '../shared/storage.js';

async function updateWordTranslation(w, targetLang) {
  const originalEx = w.example;
  const isFallback = isFallbackExample(w.word, w.example);
  
  // Fetch translation using Google Translate
  const translation = await fetchTranslation(w.word, targetLang);
  if (translation) w.translation = translation;

  // Fetch dictionary definition, transcription, example
  let dictDef = '';
  let dictEx = '';
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.word.toLowerCase())}`);
  const dictOk = response.ok;
  if (response.ok) {
    const data = await response.json();
    const first = data[0];
    if (first) {
      const def = first.meanings[0]?.definitions[0]?.definition;
      if (def) dictDef = def;

      const ipa = first.phonetics.find(p => p.text)?.text;
      if (ipa) w.transcription = ipa;

      const pos = first.meanings[0]?.partOfSpeech;
      if (pos) w.partOfSpeech = pos;

      if (first.meanings) {
        outerLoop: for (const m of first.meanings) {
          if (m.definitions) {
            for (const d of m.definitions) {
              if (d.example) {
                dictEx = d.example.trim();
                break outerLoop;
              }
            }
          }
        }
      }
    }
  }

  // Always try to fetch a premium dynamic definition first
  let newDef = await fetchDynamicDefinition(w.word);
  if (!newDef) newDef = dictDef;
  if (newDef) w.definition = newDef;

  // Always try to fetch a premium dynamic example from Cambridge/Oxford/Tatoeba first
  let newExample = await fetchDynamicExample(w.word);
  if (!newExample) newExample = dictEx;
  if (!newExample && (!w.example || isFallbackExample(w.word, w.example))) {
    newExample = getFallbackExample(w.word, w.partOfSpeech || '');
  }

  if (newExample) w.example = newExample;

  await logDebug({
    word: w.word,
    dictOk,
    isFallback,
    originalEx,
    newEx: w.example
  });
}

export async function runBackgroundRetranslate(targetLang) {
  try {
    const words = await getWords();
    await logDebug({ type: 'start', count: words.length, targetLang });
    if (words.length === 0) return;

    const batchSize = 5;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      await Promise.all(batch.map(async (w) => {
        try {
          await updateWordTranslation(w, targetLang);
        } catch (err) {
          await logDebug({ word: w.word, error: err.message });
          console.error(`Error refreshing "${w.word}" in background:`, err);
        }
      }));
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    await saveWords(words);
    await logDebug({ type: 'completed', count: words.length });
    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background retranslate failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}
