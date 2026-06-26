import { getWords, saveWords, getStored } from './core.js';
import { fetchTranslation } from './translation.js';
import { fetchDynamicDefinition } from './definitions.js';
import { fetchDynamicExample } from './examples.js';
import { isFallbackExample, getFallbackExample } from './sentence.js';
import { logActivity } from './sessions.js';
import { addWord } from './word-actions.js';

// Register a misspelling event and force-enqueue card for SRS practice
export async function registerMisspelling(correctWord, wrongSpelling, details = {}) {
  const list = await getWords();
  const wordObj = list.find(w => w.word.toLowerCase() === correctWord.toLowerCase());
  if (wordObj) {
    if (!wordObj.misspellings) wordObj.misspellings = [];
    if (wrongSpelling && wrongSpelling.toLowerCase() !== correctWord.toLowerCase()) {
      wordObj.misspellings.push(wrongSpelling);
    }
    // Increment lifetime error counter (never resets)
    wordObj.totalErrors = (wordObj.totalErrors || 0) + 1;
    wordObj.correctStreak = 0; // reset streak on error
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
