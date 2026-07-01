import { getWords, saveWords, resetDb } from '../../../shared/storage.js';
import { showConfirm, showImportOptionsModal } from '../vault.js';

export async function exportDb() {
  showConfirm(
    'Export Database (Backup)',
    'This will compile your entire Spelt vocabulary list, practice history, and activity streaks into a single JSON file and download it to your computer. Proceed?',
    async () => {
      try {
        const words = await getWords();
        let activity = {}, streak = { current: 0, lastDate: '' }, sessions = [], sandboxActivity = {};
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const res = await chrome.storage.local.get([
            'spelt_activity', 
            'spelt_streak',
            'spelt_sessions',
            'spelt_sandbox_activity'
          ]);
          activity = res.spelt_activity || {};
          streak = res.spelt_streak || { current: 0, lastDate: '' };
          sessions = res.spelt_sessions || [];
          sandboxActivity = res.spelt_sandbox_activity || {};
        }
        const dataPackage = { 
          words, 
          activity, 
          streak, 
          sessions, 
          sandbox_activity: sandboxActivity, 
          exportDate: Date.now() 
        };
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
      let importedWords = [];
      let activity = null;
      let streak = null;
      let sessions = null;
      let sandboxActivity = null;
      let isFullBackup = false;

      if (Array.isArray(parsed)) {
        importedWords = parsed;
      } else if (parsed && Array.isArray(parsed.words)) {
        importedWords = parsed.words;
        activity = parsed.activity || null;
        streak = parsed.streak || null;
        sessions = parsed.sessions || null;
        sandboxActivity = parsed.sandbox_activity || null;
        isFullBackup = true;
      } else {
        throw new Error('Invalid backup file');
      }

      // Automatically check if this file contains syntax patterns
      const hasSyntax = importedWords.some(item => 
        item.practiceType === 'syntax' || 
        (item.blocks !== undefined && Array.isArray(item.blocks))
      );

      const processImport = async (targetPracticeType) => {
        const existingWords = await getWords();
        const freshList = [...existingWords];
        let addedCount = 0;
        let updatedCount = 0;

        importedWords.forEach(item => {
          if (!item.word) return;
          const id = item.id || 'word_' + Math.random().toString(36).substring(2, 11);
          
          let practiceType = item.practiceType || 'both';
          if (!isFullBackup) {
            if (hasSyntax) {
              practiceType = 'syntax';
            } else if (targetPracticeType) {
              practiceType = targetPracticeType;
            }
          }

          const newCard = {
            id: id,
            word: item.word,
            definition: item.definition || '',
            translation: item.translation || '',
            transcription: item.transcription || '',
            partOfSpeech: item.partOfSpeech || '',
            example: item.example || '',
            exampleTranslation: item.exampleTranslation || '',
            level: item.level || '',
            otherLevels: Array.isArray(item.otherLevels) ? item.otherLevels : [],
            practiceType: practiceType,
            mastered: item.mastered || false,
            
            // Spelling SRS values
            rep: item.rep !== undefined ? item.rep : 0,
            interval: item.interval !== undefined ? item.interval : 0,
            ef: item.ef !== undefined ? item.ef : 2.5,
            nextDate: item.nextDate !== undefined ? item.nextDate : Date.now(),
            misspellings: Array.isArray(item.misspellings) ? item.misspellings : [],
            totalErrors: item.totalErrors !== undefined ? item.totalErrors : 0,
            correctStreak: item.correctStreak !== undefined ? item.correctStreak : 0,

            // Recall SRS values
            meaningRep: item.meaningRep !== undefined ? item.meaningRep : 0,
            meaningInterval: item.meaningInterval !== undefined ? item.meaningInterval : 0,
            meaningEf: item.meaningEf !== undefined ? item.meaningEf : 2.5,
            meaningNextDate: item.meaningNextDate !== undefined ? item.meaningNextDate : Date.now()
          };

          if (practiceType === 'syntax') {
            newCard.blocks = Array.isArray(item.blocks) ? item.blocks : [];
            newCard.joints = Array.isArray(item.joints) ? item.joints : [];
            newCard.writingExample = item.writingExample || item.example || '';
            newCard.ef = item.ef !== undefined ? item.ef : 2.0;
          }

          // Match existing card by ID or by matching word + type
          const idx = freshList.findIndex(w => 
            w.id === newCard.id || 
            (w.word.toLowerCase() === newCard.word.toLowerCase() && w.practiceType === newCard.practiceType)
          );

          if (idx !== -1) {
            const existingCard = freshList[idx];
            
            // Retain scheduling
            newCard.nextDate = existingCard.nextDate !== undefined ? existingCard.nextDate : newCard.nextDate;
            newCard.rep = existingCard.rep !== undefined ? existingCard.rep : newCard.rep;
            newCard.interval = existingCard.interval !== undefined ? existingCard.interval : newCard.interval;
            newCard.ef = existingCard.ef !== undefined ? existingCard.ef : newCard.ef;
            newCard.mastered = existingCard.mastered || newCard.mastered;
            newCard.misspellings = existingCard.misspellings || newCard.misspellings;
            newCard.totalErrors = existingCard.totalErrors !== undefined ? existingCard.totalErrors : newCard.totalErrors;
            newCard.correctStreak = existingCard.correctStreak !== undefined ? existingCard.correctStreak : newCard.correctStreak;
            
            newCard.meaningNextDate = existingCard.meaningNextDate !== undefined ? existingCard.meaningNextDate : newCard.meaningNextDate;
            newCard.meaningRep = existingCard.meaningRep !== undefined ? existingCard.meaningRep : newCard.meaningRep;
            newCard.meaningInterval = existingCard.meaningInterval !== undefined ? existingCard.meaningInterval : newCard.meaningInterval;
            newCard.meaningEf = existingCard.meaningEf !== undefined ? existingCard.meaningEf : newCard.meaningEf;

            // Preserve history list if present in backup but missing/empty in existing
            if (Array.isArray(item.history) && item.history.length > 0) {
              newCard.history = item.history;
            } else if (Array.isArray(existingCard.history) && existingCard.history.length > 0) {
              newCard.history = existingCard.history;
            }

            freshList[idx] = newCard;
            updatedCount++;
          } else {
            // Carry history list from backup on fresh insert
            if (Array.isArray(item.history)) {
              newCard.history = item.history;
            }
            freshList.push(newCard);
            addedCount++;
          }
        });

        await saveWords(freshList);

        // Merge activity, streak, sessions, and sandbox activity in local storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          if (activity) {
            const res = await chrome.storage.local.get('spelt_activity');
            const mergedActivity = { ...(res.spelt_activity || {}), ...activity };
            await chrome.storage.local.set({ 'spelt_activity': mergedActivity });
          }
          if (streak) {
            const res = await chrome.storage.local.get('spelt_streak');
            const currentStreak = res.spelt_streak || { current: 0, lastDate: '', max: 0 };
            const mergedStreak = {
              current: Math.max(currentStreak.current, streak.current || 0),
              max: Math.max(currentStreak.max || 0, streak.max || 0),
              lastDate: currentStreak.lastDate || streak.lastDate || ''
            };
            await chrome.storage.local.set({ 'spelt_streak': mergedStreak });
          }
          if (sessions) {
            const res = await chrome.storage.local.get('spelt_sessions');
            const existingSessions = res.spelt_sessions || [];
            const mergedSessions = [...existingSessions];
            sessions.forEach(sess => {
              if (!mergedSessions.some(s => s.startTime === sess.startTime)) {
                mergedSessions.push(sess);
              }
            });
            mergedSessions.sort((a, b) => a.startTime - b.startTime);
            if (mergedSessions.length > 200) {
              mergedSessions.splice(0, mergedSessions.length - 200);
            }
            await chrome.storage.local.set({ 'spelt_sessions': mergedSessions });
          }
          if (sandboxActivity) {
            const res = await chrome.storage.local.get('spelt_sandbox_activity');
            const existingSandbox = res.spelt_sandbox_activity || {};
            const mergedSandbox = { ...existingSandbox };
            Object.keys(sandboxActivity).forEach(date => {
              if (!mergedSandbox[date]) {
                mergedSandbox[date] = sandboxActivity[date];
              } else {
                mergedSandbox[date].checks = Math.max(mergedSandbox[date].checks, sandboxActivity[date].checks);
                mergedSandbox[date].correct = Math.max(mergedSandbox[date].correct, sandboxActivity[date].correct);
                mergedSandbox[date].misspelled = Math.max(mergedSandbox[date].misspelled, sandboxActivity[date].misspelled);
                mergedSandbox[date].notFound = Math.max(mergedSandbox[date].notFound, sandboxActivity[date].notFound);
              }
            });
            await chrome.storage.local.set({ 'spelt_sandbox_activity': mergedSandbox });
          }
        }

        showConfirm('Success', `Import complete! Added: ${addedCount} new items, Updated: ${updatedCount} existing items.`, null, false);
        if (onDbRestoredCallback) {
          await onDbRestoredCallback();
        }
      };

      if (isFullBackup) {
        showConfirm(
          'Import & Merge Library',
          'This will merge the chosen backup file into your existing library. Existing words will be updated with any new translations/examples, but their spacing and history will be preserved. No data will be wiped. Proceed?',
          () => processImport(null)
        );
      } else if (hasSyntax) {
        showConfirm(
          'Import Syntax Patterns',
          `This file contains ${importedWords.length} syntax pattern structures. Do you want to merge them into your library for Syntax practice?`,
          () => processImport('syntax')
        );
      } else {
        showImportOptionsModal(async (choice) => {
          await processImport(choice);
        });
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
