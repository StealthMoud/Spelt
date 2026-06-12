// Entry controller initializing views and database sync actions for Spelt popup
import { getWords } from '../shared/storage.js';
import { initNavigation } from './js/navigation.js';
import { initPractice, loadPracticeDeck } from './js/practice.js';
import { initVault, reloadVaultList } from './js/vault.js';
import { initSettings } from './js/settings.js';
import { initSandbox } from './js/sandbox.js';

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
    } catch (e) { console.error(e); }
  }

  initNavigation();
  
  await initPractice(() => refreshStats());
  
  await initVault(async () => {
    await refreshStats();
    await loadPracticeDeck();
  });
  
  initSettings(async () => {
    await refreshStats();
    await loadPracticeDeck();
    await reloadVaultList();
  });

  initSandbox(
    () => refreshStats(),
    () => reloadVaultList(),
    () => loadPracticeDeck()
  );

  await refreshStats();

  // immediately focus the sandbox input so user can start typing
  document.getElementById('word-input')?.focus();
});
