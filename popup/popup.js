import { getWords } from '../shared/storage.js';
import { initNavigation } from './js/navigation.js';
import { initPractice, loadPracticeDeck, syncPracticeDeck, getDueCards, getReviewedWordIds, getPracticeMode } from './js/practice.js';
import { initVault, reloadVaultList } from './js/vault.js';
import { initSettings } from './js/settings.js';
import { initSandbox } from './js/sandbox.js';
import { initStats, renderStats } from './js/stats.js';
import { initFontResizer } from './js/popup/font_resizer.js';
import { initNetworkStatus } from './js/popup/network_status.js';
import { initResizer } from './js/popup/resizer.js';
import { initSelectionLookup } from './js/popup/selection_lookup.js';
import { initMoveable } from './js/popup/moveable.js';

document.addEventListener('DOMContentLoaded', async () => {
  const dueCountEl = document.getElementById('due-count'), totalCountEl = document.getElementById('total-count');

  async function refreshStats() {
    try {
      const words = await getWords();
      const reviewedIds = getReviewedWordIds();
      const mode = getPracticeMode();
      const dueCount = words.filter(w => {
        if (reviewedIds.has(w.id)) return false;
        if (w.mastered) return false;
        if (mode === 'syntax') {
          if (w.practiceType !== 'syntax') return false;
          return w.nextDate <= Date.now();
        } else if (mode === 'recall') {
          if (w.practiceType !== 'both' && w.practiceType !== 'recall') return false;
          return w.meaningNextDate <= Date.now();
        } else {
          if (w.practiceType !== 'both' && w.practiceType !== 'spelling') return false;
          return w.nextDate <= Date.now();
        }
      }).length;

      dueCountEl.textContent = dueCount;
      totalCountEl.textContent = words.length;
      
      const badge = document.getElementById('popup-due-badge');
      if (dueCount > 0) {
        badge.textContent = dueCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      await renderStats();
    } catch (e) { console.error(e); }
  }

  initNavigation(async (targetTab) => {
    await refreshStats();
    if (targetTab === 'practice-tab') await syncPracticeDeck();
    else if (targetTab === 'vault-tab') await reloadVaultList();
    else if (targetTab === 'stats-tab') await renderStats();
  });
  
  await initPractice(() => refreshStats());
  
  await initVault(async () => {
    await refreshStats();
    await syncPracticeDeck();
  });
  
  initSettings(async () => {
    await refreshStats();
    await loadPracticeDeck();
    await reloadVaultList();
  });

  initSandbox(
    async () => { await reloadVaultList(); await refreshStats(); },
    async () => { await syncPracticeDeck(); await refreshStats(); }
  );

  await initStats();

  const refreshBtn = document.getElementById('popup-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const svg = refreshBtn.querySelector('svg');
      if (svg) { svg.style.transform = 'rotate(360deg)'; svg.style.transition = 'transform 0.5s ease-in-out'; }
      await refreshStats(); await syncPracticeDeck(); await reloadVaultList();
      setTimeout(() => { if (svg) { svg.style.transition = 'none'; svg.style.transform = 'none'; } }, 500);
    });
  }

  initFontResizer();
  initNetworkStatus();
  initResizer();
  initSelectionLookup();
  initMoveable();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'wordAddedFromContextMenu') {
      refreshStats(); syncPracticeDeck(); reloadVaultList();
    }
  });

  document.getElementById('word-input')?.focus();
  await refreshStats();
});
