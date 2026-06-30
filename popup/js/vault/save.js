import { getWords, addWord, saveWords } from '../../../shared/storage.js';
import { showConfirm } from './confirm.js';
import { closeModal } from './modal.js';

export async function saveWord(e, currentFormMisspellings, wordsList, reloadCallback, onVaultUpdatedCallback) {
  e.preventDefault();
  const id = document.getElementById('edit-word-id').value;
  const word = document.getElementById('form-word').value.trim();
  const definition = document.getElementById('form-definition').value.trim();
  const transcription = document.getElementById('form-transcription').value.trim();
  const translation = document.getElementById('form-translation').value.trim();
  const partOfSpeech = document.getElementById('form-part-of-speech').value.trim();
  const example = document.getElementById('form-example').value.trim();
  const level = document.getElementById('form-level').value.trim();
  const practiceType = document.getElementById('form-practice-type').value;
  const mastered = document.getElementById('form-mastered').checked;
 
  const executeSave = async () => {
    try {
      if (id) {
        const idx = wordsList.findIndex(w => w.id === id);
        if (idx !== -1) {
          const wasMastered = wordsList[idx].mastered;
          const oldEx = wordsList[idx].example;
          const exampleTranslation = oldEx === example ? (wordsList[idx].exampleTranslation || '') : '';
          wordsList[idx] = { 
            ...wordsList[idx], 
            word, 
            definition, 
            transcription, 
            translation, 
            partOfSpeech, 
            example, 
            exampleTranslation, 
            level,
            practiceType,
            mastered,
            misspellings: currentFormMisspellings
          };
          if (mastered && !wasMastered) {
            wordsList[idx].rep = 0;
            wordsList[idx].interval = 30;
            wordsList[idx].nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
          } else if (!mastered && wasMastered) {
            wordsList[idx].mastered = false;
            wordsList[idx].rep = 0;
            wordsList[idx].interval = 1;
            wordsList[idx].nextDate = Date.now();
          }
          await saveWords(wordsList);
        }
      } else {
        const addedWord = await addWord({ word, definition, transcription, translation, partOfSpeech, example, level, practiceType, mastered, misspellings: currentFormMisspellings });
        if (mastered) {
          const list = await getWords();
          const wObj = list.find(w => w.id === addedWord.id);
          if (wObj) {
            wObj.interval = 30;
            wObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
            await saveWords(list);
          }
        }
      }
      closeModal();
      await reloadCallback();
      if (onVaultUpdatedCallback) onVaultUpdatedCallback();
    } catch (err) {
      showConfirm('Error', err.message || 'Save failed', null, false);
    }
  };

  try {
    const isOnline = navigator.onLine;
    if (isOnline) {
      const checkRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
      if (!checkRes.ok) {
        showConfirm(
          'Unrecognized Word',
          `"${word}" is not recognized in the dictionary. Do you want to save it anyway?`,
          executeSave
        );
        return;
      }
    }
  } catch (err) {
    console.warn('Word validation failed:', err);
  }

  await executeSave();
}
