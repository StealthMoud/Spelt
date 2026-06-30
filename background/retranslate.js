import { getWords, saveWords, fetchTranslation, fetchDynamicExample, isFallbackExample, getFallbackExample, logDebug, fetchDynamicDefinition, fetchCambridgePronunciation } from '../shared/storage.js';

function getBaseLemmas(word) {
  const lemmas = [];
  const clean = word.toLowerCase().trim();
  
  if (clean.endsWith('ed') && clean.length > 3) {
    lemmas.push(clean.slice(0, -2));
    lemmas.push(clean.slice(0, -1));
  }
  if (clean.endsWith('ing') && clean.length > 4) {
    lemmas.push(clean.slice(0, -3));
    lemmas.push(clean.slice(0, -3) + 'e');
  }
  if (clean.endsWith('s') && clean.length > 2) {
    if (clean.endsWith('es')) {
      lemmas.push(clean.slice(0, -2));
    }
    lemmas.push(clean.slice(0, -1));
  }
  
  // Handle double consonant base stripping (e.g. running -> run, dropped -> drop)
  const doubleConsonants = ['bb', 'dd', 'ff', 'gg', 'll', 'mm', 'nn', 'pp', 'rr', 'ss', 'tt', 'zz'];
  const extra = [];
  lemmas.forEach(lemma => {
    if (lemma.length > 2) {
      const end = lemma.slice(-2);
      if (doubleConsonants.includes(end)) {
        extra.push(lemma.slice(0, -1));
      }
    }
  });
  lemmas.push(...extra);
  
  return [...new Set(lemmas)].filter(l => l.length > 1 && l !== clean);
}

async function updateWordTranslation(wordId, targetLang) {
  const initialList = await getWords();
  const card = initialList.find(x => x.id === wordId);
  if (!card) return;

  const wordStr = card.word;
  const originalEx = card.example;
  const isFallback = isFallbackExample(wordStr, card.example);
  
  // 1. Fetch translation using Google Translate
  let translation = '';
  if (targetLang && targetLang !== 'none') {
    translation = await fetchTranslation(wordStr, targetLang) || '';
  }

  // 2. Fetch dictionary definitions, partOfSpeech, etc. from dictionary API as a base fallback
  let dictDef = '';
  let dictEx = '';
  let dictIpa = '';
  let dictPos = '';
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(wordStr.toLowerCase())}`);
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
  const defResult = await fetchDynamicDefinition(wordStr);
  const newDef = defResult.definition || dictDef;
  
  // 4. Fetch premium transcription from Cambridge/Oxford (to override low-quality Dictionary API transcription)
  const cambridge = await fetchCambridgePronunciation(wordStr);
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

  // Calculate final level and levels with morphological lemma fallback for inflected words
  let finalLevel = defResult.level || cambridge.level || '';
  let allLevels = defResult.allLevels || cambridge.allLevels || [];
  if (!finalLevel) {
    const lemmas = getBaseLemmas(wordStr);
    for (const lemma of lemmas) {
      const lemmaDef = await fetchDynamicDefinition(lemma);
      if (lemmaDef.level) {
        finalLevel = lemmaDef.level;
        allLevels = lemmaDef.allLevels;
        break;
      }
      const lemmaPr = await fetchCambridgePronunciation(lemma);
      if (lemmaPr.level) {
        finalLevel = lemmaPr.level;
        allLevels = lemmaPr.allLevels;
        break;
      }
    }
  }

  // Sanitize Part of Speech to fall back if currently placeholder "Unknown"
  const activePos = (card.partOfSpeech && card.partOfSpeech.toLowerCase() !== 'unknown') ? card.partOfSpeech : '';
  const finalPos = activePos || dictPos || 'unknown';

  // 5. Fetch premium dynamic example
  let newExample = await fetchDynamicExample(wordStr);
  if (!newExample) newExample = dictEx;
  if (!newExample && (!card.example || isFallbackExample(wordStr, card.example))) {
    newExample = getFallbackExample(wordStr, finalPos);
  }

  // Load the fresh list from database again to ensure we do not overwrite concurrent UI operations
  const list = await getWords();
  const w = list.find(x => x.id === wordId);
  if (w) {
    if (translation) w.translation = translation;
    if (newDef) w.definition = newDef;
    if (finalLevel) {
      w.level = finalLevel;
      w.otherLevels = allLevels.filter(l => l !== w.level);
    }
    if (transcriptionVal) w.transcription = transcriptionVal;
    if (newExample) {
      if (w.example !== newExample) {
        w.example = newExample;
        w.exampleTranslation = '';
      }
    }
    if (finalPos && finalPos !== 'unknown') {
      w.partOfSpeech = finalPos;
    }

    await saveWords(list);
  }

  await logDebug({
    word: wordStr,
    isFallback,
    originalEx,
    newEx: newExample,
    level: finalLevel,
    transcription: transcriptionVal
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
          await updateWordTranslation(w.id, targetLang);
        } catch (err) {
          await logDebug({ word: w.word, error: err.message });
          console.error(`Error refreshing "${w.word}" in background:`, err);
        }
      }));
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    await logDebug({ type: 'completed', count: words.length });
    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background retranslate failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}
