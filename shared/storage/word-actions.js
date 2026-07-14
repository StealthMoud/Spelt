import { getWords, saveWords, getStored, atomicUpdate } from './core.js';
import { fetchTranslation } from './translation.js';
import { fetchDynamicDefinition } from './definitions.js';
import { fetchDynamicExample } from './examples.js';
import { getFallbackExample } from './sentence.js';
import { fetchCambridgePronunciation } from './cambridge.js';
import { logActivity } from './sessions.js';
import { getSpellingVariant } from './spelling-variants.js';

// Add a single word
export async function addWord(wordData) {
  let initialCheckList = await getWords();
  const normalizedWord = wordData.word.trim();
  
  if (initialCheckList.some(w => w.word.toLowerCase() === normalizedWord.toLowerCase())) {
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
  let levelVal = wordData.level || '';
  let otherLevels = [];

  if (!definitionVal || definitionVal === 'No definition found') {
    const defResult = await fetchDynamicDefinition(normalizedWord);
    definitionVal = defResult.definition || definitionVal;
    if (!levelVal && defResult.level) levelVal = defResult.level;
    otherLevels = (defResult.allLevels || []).filter(l => l !== levelVal);
  }

  const exampleVal = wordData.example?.trim() || await fetchDynamicExample(normalizedWord) || getFallbackExample(normalizedWord, partOfSpeechVal);
  const exampleTranslationVal = wordData.exampleTranslation?.trim() || '';

  let transcriptionVal = wordData.transcription?.trim() || '';
  if (!transcriptionVal || transcriptionVal === '/--/' || !levelVal) {
    try {
      const cambridge = await fetchCambridgePronunciation(normalizedWord);
      if (!transcriptionVal || transcriptionVal === '/--/') {
        if (cambridge.ukIpa && cambridge.usIpa) {
          transcriptionVal = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.usIpa} (US) / ${cambridge.ukIpa} (UK)`;
        } else {
          transcriptionVal = cambridge.usIpa || cambridge.ukIpa || '';
        }
      }
      if (!levelVal) levelVal = cambridge.level || '';
      if (otherLevels.length === 0 && cambridge.allLevels) {
        otherLevels = cambridge.allLevels.filter(l => l !== levelVal);
      }
    } catch (_) {}
  }

  // Look up US/UK spelling variant
  const spellingVariant = getSpellingVariant(normalizedWord);

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
    meaningRep: 0,
    meaningInterval: 0,
    meaningEf: 2.5,
    meaningNextDate: wordData.nextDate !== undefined ? wordData.nextDate : Date.now(),
    practiceType: wordData.practiceType || 'spelling',
    mastered: wordData.mastered || false,
    nextDate: wordData.nextDate !== undefined ? wordData.nextDate : Date.now(),
    createdAt: Date.now(),
    history: [],
    level: levelVal.toUpperCase().trim(),
    otherLevels: otherLevels,
    misspellings: Array.isArray(wordData.misspellings) ? wordData.misspellings : [],
    blocks: Array.isArray(wordData.blocks) ? wordData.blocks : undefined,
    joints: Array.isArray(wordData.joints) ? wordData.joints : undefined,
    totalErrors: wordData.totalErrors || 0,
    correctStreak: 0,
    usSpelling: wordData.usSpelling || (spellingVariant ? spellingVariant.us : ''),
    ukSpelling: wordData.ukSpelling || (spellingVariant ? spellingVariant.uk : '')
  };

  await atomicUpdate(async (freshList) => {
    // Re-check existence to prevent race condition insertions
    if (!freshList.some(w => w.word.toLowerCase() === normalizedWord.toLowerCase())) {
      freshList.push(newWord);
    }
  });

  await logActivity();
  return newWord;
}

// Delete a single word by its ID
export async function deleteWord(wordId) {
  await atomicUpdate(async (freshList) => {
    const idx = freshList.findIndex(w => w.id === wordId);
    if (idx !== -1) freshList.splice(idx, 1);
  });
}
