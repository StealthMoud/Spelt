import { getWords, resetDb, atomicUpdate } from '../../../shared/storage.js';
import { showConfirm, showImportOptionsModal } from '../vault.js';
import { normalizeBackupMetadata, normalizeImportedWord, validateBackupShape } from '../../../src/data/backup.js';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

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
  if (file.size > MAX_BACKUP_BYTES) {
    showConfirm('Import Error', 'This backup is larger than 5 MB. Split it into smaller files and try again.', null, false);
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      let importedWords = [];
      let activity = null;
      let streak = null;
      let sessions = null;
      let sandboxActivity = null;
      const backupShape = validateBackupShape(parsed);
      const isFullBackup = backupShape.isFullBackup;
      importedWords = backupShape.words;

      if (isFullBackup) {
        ({ activity, streak, sessions, sandboxActivity } = normalizeBackupMetadata(parsed));
      }



      const processImport = async (targetPracticeType) => {
        let addedCount = 0;
        let updatedCount = 0;

        await atomicUpdate(async (freshList) => {
          importedWords.forEach(item => {
            const newCard = normalizeImportedWord(item, {
              practiceTypeOverride: !isFullBackup ? targetPracticeType : null
            });
            if (!newCard) return;



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
              newCard.createdAt = existingCard.createdAt !== undefined ? existingCard.createdAt : newCard.createdAt;
              newCard.masteredAt = existingCard.masteredAt || newCard.masteredAt;
              
              newCard.meaningNextDate = existingCard.meaningNextDate !== undefined ? existingCard.meaningNextDate : newCard.meaningNextDate;
              newCard.meaningRep = existingCard.meaningRep !== undefined ? existingCard.meaningRep : newCard.meaningRep;
              newCard.meaningInterval = existingCard.meaningInterval !== undefined ? existingCard.meaningInterval : newCard.meaningInterval;
              newCard.meaningEf = existingCard.meaningEf !== undefined ? existingCard.meaningEf : newCard.meaningEf;

              // Existing review history remains authoritative during a merge.
              if (Array.isArray(existingCard.history) && existingCard.history.length > 0) {
                newCard.history = existingCard.history;
              }

              freshList[idx] = newCard;
              updatedCount++;
            } else {
              freshList.push(newCard);
              addedCount++;
            }
          });
        });

        // Merge activity, streak, sessions, and sandbox activity in local storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          if (activity) {
            const res = await chrome.storage.local.get('spelt_activity');
            const mergedActivity = { ...(res.spelt_activity || {}) };
            Object.entries(activity).forEach(([date, count]) => {
              mergedActivity[date] = Math.max(Number(mergedActivity[date]) || 0, count);
            });
            await chrome.storage.local.set({ 'spelt_activity': mergedActivity });
          }
          if (streak) {
            const res = await chrome.storage.local.get('spelt_streak');
            const currentStreak = res.spelt_streak || { current: 0, lastDate: '', max: 0 };
            const useImportedCurrent = (streak.lastDate || '') > (currentStreak.lastDate || '');
            const mergedStreak = {
              current: useImportedCurrent ? streak.current : (currentStreak.current || 0),
              max: Math.max(currentStreak.max || 0, streak.max || 0),
              lastDate: useImportedCurrent ? streak.lastDate : (currentStreak.lastDate || streak.lastDate || '')
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

        showConfirm('Import complete', `Added ${addedCount} new items and updated ${updatedCount} existing items.`, null, false);
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
  showConfirm(
    'Wipe Database',
    'Are you sure you want to delete all words and activity data? Type DELETE to confirm. This action cannot be undone.',
    async () => {
      await resetDb();
      showConfirm('Data erased', 'Your words, review history, sessions, and learning statistics were erased.', null, false);
      if (onDbRestoredCallback) {
        await onDbRestoredCallback();
      }
    },
    true,
    'DELETE'
  );
}
