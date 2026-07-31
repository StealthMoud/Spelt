import { getWords } from '../shared/storage.js';
import { selectDueCards } from '../src/core/selectors.js';
import { initNavigation } from './js/navigation.js';
import { initPractice, loadPracticeDeck, syncPracticeDeck, hasReviewedWord, getPracticeMode, refreshReviewedWordDay, clearReviewedWords } from './js/practice.js';
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
  let midnightTimerId = null;

  async function refreshStats() {
    try {
      refreshReviewedWordDay();
      const words = await getWords();
      const mode = getPracticeMode();
      const dueCards = selectDueCards(words, mode, {
        excludeIds: new Set(words.filter(w => hasReviewedWord(w.id, mode)).map(w => w.id))
      });
      const dueCount = dueCards.length;

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

  async function refreshAfterDailyRollover() {
    await refreshStats();
    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'practice-tab') await loadPracticeDeck();
    else if (activeTab === 'vault-tab') await reloadVaultList();
    else if (activeTab === 'stats-tab') await renderStats();
  }

  function msUntilNextLocalMidnight() {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    return Math.max(1000, nextMidnight.getTime() - now.getTime());
  }

  function scheduleMidnightRollover() {
    if (midnightTimerId) clearTimeout(midnightTimerId);
    midnightTimerId = setTimeout(async () => {
      clearReviewedWords();
      await refreshAfterDailyRollover();
      scheduleMidnightRollover();
    }, msUntilNextLocalMidnight());
  }

  async function catchMissedDailyRollover() {
    if (refreshReviewedWordDay()) {
      await refreshAfterDailyRollover();
      scheduleMidnightRollover();
    }
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
  scheduleMidnightRollover();
  window.addEventListener('focus', () => { catchMissedDailyRollover().catch(console.error); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      catchMissedDailyRollover().catch(console.error);
    }
  });

  /** Pull every view back in line with what is actually in storage. */
  async function refreshEverything() {
    await Promise.all([refreshStats(), syncPracticeDeck(), reloadVaultList()]);
  }

  const refreshBtn = document.getElementById('popup-refresh-btn');
  if (refreshBtn) {
    let refreshing = false;
    refreshBtn.addEventListener('click', async () => {
      // Without this a second click starts a second refresh over the top of the
      // first, and both race to write the same counts and lists.
      if (refreshing) return;
      refreshing = true;
      refreshBtn.disabled = true;
      // Spins for as long as the work actually takes, rather than for a fixed
      // half second that could end well before the data landed.
      refreshBtn.classList.add('is-refreshing');
      try {
        await refreshEverything();
      } catch (err) {
        console.error('Manual refresh failed:', err);
      } finally {
        refreshing = false;
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('is-refreshing');
      }
    });
  }

  initFontResizer();
  initNetworkStatus();
  initResizer();
  initSelectionLookup();
  initMoveable();

  // Everything the open views are derived from. Watching only `spelt_words`
  // left the Stats tab stale whenever a sandbox check or a finished session
  // updated the activity, streak or session records without touching the word
  // list — the manual refresh button was the only way back to the truth.
  const WATCHED_KEYS = [
    'spelt_words',
    'spelt_activity',
    'spelt_streak',
    'spelt_sessions',
    'spelt_sandbox_activity'
  ];

  chrome.storage?.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    if (!WATCHED_KEYS.some(key => key in changes)) return;

    const activeTab = document.querySelector('.tab-btn.active')?.getAttribute('data-tab');
    await refreshStats();

    // Only the word list can change what these two show; the activity records
    // cannot, so re-rendering them on a session write would be wasted work.
    if (!changes.spelt_words) return;
    if (activeTab === 'practice-tab') {
      await syncPracticeDeck();
    } else if (activeTab === 'vault-tab') {
      await reloadVaultList();
    }
  });

  document.getElementById('word-input')?.focus();
  await refreshStats();
});
