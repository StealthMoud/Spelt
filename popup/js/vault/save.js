import { addWord, fetchDynamicDefinition, atomicUpdate, getNextReviewDate } from '../../../shared/storage.js';
import { showConfirm } from './confirm.js';
import { closeModal } from './modal.js';

export async function saveWord(e, currentFormMisspellings, reloadCallback, onVaultUpdatedCallback) {
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
        await atomicUpdate(async (freshList) => {
          const idx = freshList.findIndex(w => w.id === id);
          if (idx !== -1) {
            const wasMastered = freshList[idx].mastered;
            const oldEx = freshList[idx].example;
            const exampleTranslation = oldEx === example ? (freshList[idx].exampleTranslation || '') : '';
            freshList[idx] = {
              ...freshList[idx],
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
              freshList[idx].rep = 0;
              freshList[idx].interval = 30;
              freshList[idx].nextDate = getNextReviewDate(30);
            } else if (!mastered && wasMastered) {
              freshList[idx].mastered = false;
              freshList[idx].rep = 0;
              freshList[idx].interval = 1;
              freshList[idx].nextDate = Date.now();
            }
          }
        });
      } else {
        const addedWord = await addWord({ word, definition, transcription, translation, partOfSpeech, example, level, practiceType, mastered, misspellings: currentFormMisspellings });
        if (mastered) {
          await atomicUpdate(async (list) => {
            const wObj = list.find(w => w.id === addedWord.id);
            if (wObj) {
              wObj.interval = 30;
              wObj.nextDate = getNextReviewDate(30);
            }
          });
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
      // 1. Try our robust definition lookup (queries Cambridge and Oxford, handling multi-word hyphens)
      const res = await fetchDynamicDefinition(word);
      
      // 2. If dynamic definition is empty, fallback to Free Dictionary API validation check
      if (!res || !res.definition) {
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
    }
  } catch (err) {
    console.warn('Word validation failed:', err);
  }

  await executeSave();
}
