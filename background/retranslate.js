import { getWords, saveWords, fetchTranslation, fetchDynamicExample, isFallbackExample, getFallbackExample, logDebug, fetchDynamicDefinition, fetchCambridgePronunciation } from '../shared/storage.js';

async function updateWordTranslation(w, targetLang) {
  const originalEx = w.example;
  const isFallback = isFallbackExample(w.word, w.example);
  
  // 1. Fetch translation using Google Translate
  if (targetLang && targetLang !== 'none') {
    const translation = await fetchTranslation(w.word, targetLang);
    if (translation) w.translation = translation;
  }

  // 2. Fetch dictionary definitions, partOfSpeech, etc. from dictionary API as a base fallback
  let dictDef = '';
  let dictEx = '';
  let dictIpa = '';
  let dictPos = '';
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.word.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      const first = data[0];
      if (first) {
        dictDef = first.meanings[0]?.definitions[0]?.definition || '';
        dictIpa = first.phonetics.find(p => p.text)?.text || '';
        dictPos = first.meanings[0]?.partOfSpeech || '';
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
  } catch (_) {}

  // 3. Fetch premium dynamic definition, level, and otherLevels from Cambridge/Oxford
  const defResult = await fetchDynamicDefinition(w.word);
  const newDef = defResult.definition || dictDef;
  if (newDef) w.definition = newDef;
  
  // Always update levels (overwrite existing ones to keep them fresh and correct)
  if (defResult.level) {
    w.level = defResult.level;
    w.otherLevels = (defResult.allLevels || []).filter(l => l !== w.level);
  }

  // 4. Fetch premium transcription from Cambridge/Oxford (to override low-quality Dictionary API transcription)
  const cambridge = await fetchCambridgePronunciation(w.word);
  let transcriptionVal = '';
  if (cambridge.ukIpa || cambridge.usIpa) {
    if (cambridge.ukIpa && cambridge.usIpa) {
      transcriptionVal = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
    } else {
      transcriptionVal = cambridge.ukIpa || cambridge.usIpa || '';
    }
  } else {
    transcriptionVal = dictIpa;
  }
  if (transcriptionVal) w.transcription = transcriptionVal;

  if (cambridge.level) {
    w.level = cambridge.level;
    w.otherLevels = (cambridge.allLevels || []).filter(l => l !== w.level);
  }

  // 5. Fetch premium dynamic example
  let newExample = await fetchDynamicExample(w.word);
  if (!newExample) newExample = dictEx;
  if (!newExample && (!w.example || isFallbackExample(w.word, w.example))) {
    newExample = getFallbackExample(w.word, w.partOfSpeech || dictPos || '');
  }

  if (newExample) {
    // If the example is actually changing, clear the old example translation to prevent displaying a mismatch
    if (w.example !== newExample) {
      w.example = newExample;
      w.exampleTranslation = '';
    }
  }

  if (dictPos) {
    w.partOfSpeech = dictPos;
  }

  await logDebug({
    word: w.word,
    isFallback,
    originalEx,
    newEx: w.example,
    level: w.level,
    transcription: w.transcription
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
