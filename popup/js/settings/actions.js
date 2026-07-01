import { getWords, saveWords, resetDb } from '../../../shared/storage.js';
import { showConfirm } from '../vault.js';

export async function exportDb() {
  showConfirm(
    'Export Database',
    'Do you want to download a backup of your Spelt library?',
    async () => {
      try {
        const words = await getWords();
        let activity = {}, streak = { current: 0, lastDate: '' };
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const res = await chrome.storage.local.get(['spelt_activity', 'spelt_streak']);
          activity = res.spelt_activity || {};
          streak = res.spelt_streak || { current: 0, lastDate: '' };
        }
        const dataPackage = { words, activity, streak, exportDate: Date.now() };
        const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `spelt_library_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        showConfirm('Export Error', 'Export failed: ' + e.message, null, false);
      }
    }
  );
}

export async function importDb(e, onDbRestoredCallback) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      let words;
      if (Array.isArray(parsed)) {
        words = parsed;
      } else if (parsed && Array.isArray(parsed.words)) {
        words = parsed.words;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          if (parsed.activity) await chrome.storage.local.set({ 'spelt_activity': parsed.activity });
          if (parsed.streak) await chrome.storage.local.set({ 'spelt_streak': parsed.streak });
        }
      } else {
        throw new Error('Invalid backup file');
      }
      await saveWords(words);
      showConfirm('Success', 'Library restored successfully!', null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    } catch (err) {
      showConfirm('Import Error', 'Import failed: ' + err.message, null, false);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

export async function wipeDb(onDbRestoredCallback) {
  const captcha = Math.random().toString(36).substring(2, 8).toUpperCase();
  showConfirm(
    'Wipe Database',
    'Are you sure you want to delete all words and activity data? This action cannot be undone.',
    async () => {
      await resetDb();
      showConfirm('Purged', 'Database purged successfully!', null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    },
    true,
    captcha
  );
}

export async function importSyntaxDb(e, onDbRestoredCallback) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) {
        throw new Error('JSON format must be an array of syntax cards');
      }
      
      const existing = await getWords();
      const freshList = [...existing];
      let addedCount = 0;
      let updatedCount = 0;

      parsed.forEach(item => {
        const id = item.id || 'syntax_' + Math.random().toString(36).substring(2, 11);
        
        const newCard = {
          id: id,
          word: item.word || 'Unnamed Pattern',
          practiceType: 'syntax',
          definition: item.definition || '',
          translation: item.translation || '',
          example: item.example || '',
          blocks: Array.isArray(item.blocks) ? item.blocks : [],
          joints: Array.isArray(item.joints) ? item.joints : [],
          writingExample: item.writingExample || item.example || '',
          nextDate: item.nextDate || Date.now(),
          rep: item.rep !== undefined ? item.rep : 0,
          interval: item.interval !== undefined ? item.interval : 0,
          ef: item.ef !== undefined ? item.ef : 2.0,
          mastered: item.mastered || false
        };

        const idx = freshList.findIndex(w => 
          w.id === newCard.id || 
          w.example === newCard.example || 
          (w.word === newCard.word && w.practiceType === 'syntax')
        );

        if (idx !== -1) {
          const existingCard = freshList[idx];
          newCard.nextDate = existingCard.nextDate || newCard.nextDate;
          newCard.rep = existingCard.rep !== undefined ? existingCard.rep : newCard.rep;
          newCard.interval = existingCard.interval !== undefined ? existingCard.interval : newCard.interval;
          newCard.ef = existingCard.ef !== undefined ? existingCard.ef : newCard.ef;
          newCard.mastered = existingCard.mastered || newCard.mastered;
          
          freshList[idx] = newCard;
          updatedCount++;
        } else {
          freshList.push(newCard);
          addedCount++;
        }
      });

      await saveWords(freshList);
      showConfirm('Success', `Syntax patterns imported successfully! Added: ${addedCount}, Updated: ${updatedCount}`, null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    } catch (err) {
      showConfirm('Import Error', 'Import failed: ' + err.message, null, false);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}
