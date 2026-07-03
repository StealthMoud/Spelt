import { getWords, getStored, atomicUpdate } from './core.js';
import { fetchTranslation } from './translation.js';
import { fetchDynamicDefinition } from './definitions.js';
import { fetchDynamicExample } from './examples.js';
import { isFallbackExample, getFallbackExample } from './sentence.js';
import { logActivity } from './sessions.js';
import { addWord } from './word-actions.js';

// Register a misspelling event and force-enqueue card for SRS practice
export async function registerMisspelling(correctWord, wrongSpelling, details = {}) {
  let list = await getWords();
  let wordObj = list.find(w => w.word.toLowerCase() === correctWord.toLowerCase());

  if (wordObj) {
    // 1. Perform all slow async fetches outside the atomic lock
    let tr = wordObj.translation?.trim() ? null : null;
    if (!wordObj.translation?.trim()) {
      const targetLang = await getStored('spelt_target_lang');
      if (targetLang && targetLang !== 'none') {
        tr = await fetchTranslation(correctWord, targetLang);
      }
    }

    let dynamicDef = null;
    if (!wordObj.definition?.trim() || wordObj.definition === 'No definition found') {
      dynamicDef = details.definition?.trim() || (await fetchDynamicDefinition(correctWord)).definition;
    }

    let dynamicEx = null;
    if (!wordObj.example?.trim() || isFallbackExample(correctWord, wordObj.example)) {
      dynamicEx = details.example?.trim() || await fetchDynamicExample(correctWord);
    }

    // 2. Perform the atomic update with the fetched values
    let returnObj = null;
    await atomicUpdate(async (freshList) => {
      const w = freshList.find(x => x.word.toLowerCase() === correctWord.toLowerCase());
      if (w) {
        if (!w.misspellings) w.misspellings = [];
        if (wrongSpelling && wrongSpelling.toLowerCase() !== correctWord.toLowerCase()) {
          w.misspellings.push(wrongSpelling);
        }
        // Increment lifetime error counter (never resets)
        w.totalErrors = (w.totalErrors || 0) + 1;
        w.correctStreak = 0; // reset streak on error
        w.mastered = false; // re-enter SRS if previously mastered
        w.rep = 0;
        w.interval = 1;
        w.nextDate = Date.now(); // due immediately for practice

        if (tr && !w.translation?.trim()) w.translation = tr;

        if (details.partOfSpeech && !w.partOfSpeech) w.partOfSpeech = details.partOfSpeech;
        if (details.level && !w.level) w.level = details.level;

        if (dynamicDef && (!w.definition?.trim() || w.definition === 'No definition found')) {
          w.definition = dynamicDef;
        }

        if (dynamicEx && (!w.example?.trim() || isFallbackExample(correctWord, w.example))) {
          w.example = dynamicEx;
          w.exampleTranslation = ''; // reset translation if example changed
        } else if (!w.example) {
          w.example = getFallbackExample(correctWord, w.partOfSpeech || details.partOfSpeech || '');
        }

        if (details.example && details.example !== w.example) {
          w.example = details.example;
          w.exampleTranslation = details.exampleTranslation || '';
        } else {
          if (details.exampleTranslation && !w.exampleTranslation) {
            w.exampleTranslation = details.exampleTranslation;
          }
        }
        returnObj = { ...w }; // clone to return
      }
    });

    return returnObj;
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
