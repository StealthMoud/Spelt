// Entry controller initializing views and database sync actions for Spelt popup
import { getWords } from '../shared/storage.js';
import { initNavigation } from './js/navigation.js';
import { initPractice, loadPracticeDeck, syncPracticeDeck } from './js/practice.js';
import { initVault, reloadVaultList } from './js/vault.js';
import { initSettings } from './js/settings.js';
import { initSandbox } from './js/sandbox.js';
import { initStats, renderStats } from './js/stats.js';

document.addEventListener('DOMContentLoaded', async () => {
  const dueCountEl = document.getElementById('due-count'), totalCountEl = document.getElementById('total-count');

  async function refreshStats() {
    try {
      const words = await getWords();
      const dueCount = words.filter(w => w.nextDate <= Date.now() && !w.mastered).length;
      dueCountEl.textContent = dueCount;
      totalCountEl.textContent = words.length;
      
      const badge = document.getElementById('popup-due-badge');
      if (dueCount > 0) {
        badge.textContent = dueCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      
      // Keep stats dashboard synchronized on any database change
      await renderStats();
    } catch (e) { console.error(e); }
  }

  initNavigation(async (targetTab) => {
    await refreshStats();
    if (targetTab === 'practice-tab') {
      await syncPracticeDeck();
    } else if (targetTab === 'vault-tab') {
      await reloadVaultList();
    } else if (targetTab === 'stats-tab') {
      await renderStats();
    }
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
    () => reloadVaultList(),
    () => syncPracticeDeck()
  );

  // Initialize stats dashboard logic
  await initStats();

  // Manual refresh button listener with spin micro-animation
  const refreshBtn = document.getElementById('popup-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const svg = refreshBtn.querySelector('svg');
      if (svg) {
        svg.style.transform = 'rotate(360deg)';
        svg.style.transition = 'transform 0.5s ease-in-out';
      }
      await refreshStats();
      await syncPracticeDeck();
      await reloadVaultList();
      setTimeout(() => {
        if (svg) {
          svg.style.transition = 'none';
          svg.style.transform = 'none';
        }
      }, 500);
    });
  }

  await refreshStats();

  // immediately focus the sandbox input so user can start typing
  document.getElementById('word-input')?.focus();
});
