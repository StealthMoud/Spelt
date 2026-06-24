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
    async () => {
      await reloadVaultList();
      await refreshStats();
    },
    async () => {
      await syncPracticeDeck();
      await refreshStats();
    }
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

  const statusDot = document.querySelector('.user-status-dot');
  const userLabel = document.querySelector('.user-label');
  const sessionInfo = document.querySelector('.session-info');
  const offlineBanner = document.getElementById('offline-banner');
  const offlineBannerText = offlineBanner ? offlineBanner.querySelector('span') : null;

  let hasConnectionError = false;

  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (statusDot && userLabel && sessionInfo) {
      // Clear current states
      statusDot.classList.remove('active', 'offline', 'connection-error');
      sessionInfo.classList.remove('offline', 'connection-error');
      if (offlineBanner) {
        offlineBanner.classList.remove('connection-error', 'visible');
      }

      if (!isOnline) {
        statusDot.classList.add('offline');
        sessionInfo.classList.add('offline');
        userLabel.textContent = 'Offline';
        userLabel.style.color = 'var(--danger)';
        if (offlineBanner && offlineBannerText) {
          offlineBannerText.textContent = 'Offline mode. Dict lookup and translation unavailable.';
          offlineBanner.classList.add('visible');
        }
      } else if (hasConnectionError) {
        statusDot.classList.add('connection-error');
        sessionInfo.classList.add('connection-error');
        userLabel.textContent = 'Connection Error';
        userLabel.style.color = 'var(--warning)';
        if (offlineBanner && offlineBannerText) {
          offlineBannerText.textContent = 'API fetch failed. Check your internet connection.';
          offlineBanner.classList.add('connection-error', 'visible');
        }
      } else {
        statusDot.classList.add('active');
        userLabel.textContent = 'Local Profile';
        userLabel.style.color = '';
      }
    }
  }

  window.addEventListener('online', () => {
    hasConnectionError = false;
    updateNetworkStatus();
  });
  window.addEventListener('offline', () => {
    updateNetworkStatus();
  });
  window.addEventListener('network-error', () => {
    hasConnectionError = true;
    updateNetworkStatus();
  });
  window.addEventListener('network-success', () => {
    if (hasConnectionError) {
      hasConnectionError = false;
      updateNetworkStatus();
    }
  });

  updateNetworkStatus();

  await refreshStats();

  function initResizer() {
    const handles = document.querySelectorAll('.resizer');
    let startX, startY, startWidth, startHeight;
    let activeHandle = null;

    chrome.storage?.local.get(['spelt_popup_width', 'spelt_popup_height'], (res) => {
      const width = res.spelt_popup_width || 360;
      const height = res.spelt_popup_height || 530;
      
      document.body.style.width = width + 'px';
      document.body.style.height = height + 'px';
      document.documentElement.style.width = width + 'px';
      document.documentElement.style.height = height + 'px';
    });

    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        activeHandle = handle;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(document.body).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(document.body).height, 10);
        handle.classList.add('dragging');
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
      });
    });

    function drag(e) {
      if (!activeHandle) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      const isL = activeHandle.classList.contains('resizer-l') || activeHandle.classList.contains('resizer-bl') || activeHandle.classList.contains('resizer-tl');
      const isR = activeHandle.classList.contains('resizer-r') || activeHandle.classList.contains('resizer-br') || activeHandle.classList.contains('resizer-tr');
      const isB = activeHandle.classList.contains('resizer-b') || activeHandle.classList.contains('resizer-bl') || activeHandle.classList.contains('resizer-br');
      const isT = activeHandle.classList.contains('resizer-t') || activeHandle.classList.contains('resizer-tl') || activeHandle.classList.contains('resizer-tr');

      if (isR) {
        newWidth = startWidth + dx;
      } else if (isL) {
        newWidth = startWidth - dx;
      }

      if (isB) {
        newHeight = startHeight + dy;
      } else if (isT) {
        newHeight = startHeight - dy;
      }

      newWidth = Math.max(320, Math.min(800, newWidth));
      newHeight = Math.max(400, Math.min(600, newHeight));

      document.body.style.width = newWidth + 'px';
      document.body.style.height = newHeight + 'px';
      document.documentElement.style.width = newWidth + 'px';
      document.documentElement.style.height = newHeight + 'px';
    }

    function stopDrag() {
      if (activeHandle) {
        activeHandle.classList.remove('dragging');
        const finalWidth = parseInt(document.body.style.width, 10);
        const finalHeight = parseInt(document.body.style.height, 10);
        if (finalWidth && finalHeight) {
          chrome.storage?.local.set({
            spelt_popup_width: finalWidth,
            spelt_popup_height: finalHeight
          });
        }
        activeHandle = null;
      }
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', stopDrag);
    }
  }

  initResizer();

  function initSelectionLookup() {
    const floatingBtn = document.createElement('button');
    floatingBtn.id = 'floating-lookup-btn';
    floatingBtn.className = 'floating-lookup-btn';
    floatingBtn.type = 'button';
    floatingBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Lookup</span>
    `;
    document.body.appendChild(floatingBtn);

    let isSelectionLookupEnabled = true;

    // Load initial setting
    chrome.storage?.local.get('spelt_selection_lookup', (res) => {
      isSelectionLookupEnabled = res.spelt_selection_lookup !== false;
    });

    // Watch for setting updates
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.spelt_selection_lookup) {
        isSelectionLookupEnabled = changes.spelt_selection_lookup.newValue !== false;
        if (!isSelectionLookupEnabled) {
          hideBtn();
        }
      }
    });

    function hideBtn() {
      floatingBtn.classList.remove('visible');
    }

    document.addEventListener('selectionchange', () => {
      if (!isSelectionLookupEnabled) return;
      
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (!text || text.length < 2 || text.length > 40 || text.includes('\n')) {
        hideBtn();
        return;
      }
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        if (rect.width > 0 && rect.height > 0) {
          const btnWidth = 72;
          let left = rect.left + rect.width / 2;
          let top = rect.top + window.scrollY;
          
          const viewportWidth = document.body.clientWidth || window.innerWidth;
          if (left < btnWidth / 2) left = btnWidth / 2;
          if (left > viewportWidth - btnWidth / 2) left = viewportWidth - btnWidth / 2;
          
          floatingBtn.style.left = `${left}px`;
          floatingBtn.style.top = `${top}px`;
          floatingBtn.classList.add('visible');
        } else {
          hideBtn();
        }
      } else {
        hideBtn();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('#floating-lookup-btn')) return;
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection.toString().trim()) {
          hideBtn();
        }
      }, 50);
    });

    floatingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (text) {
        selection.removeAllRanges();
        hideBtn();
        
        const sandboxTabBtn = document.querySelector('.tab-btn[data-tab="sandbox-tab"]');
        if (sandboxTabBtn) {
          sandboxTabBtn.click();
        }
        
        const wordInput = document.getElementById('word-input');
        if (wordInput) {
          wordInput.value = text;
          const form = document.getElementById('quick-add-form');
          if (form) {
            form.dispatchEvent(new Event('submit'));
          }
        }
      }
    });
  }

  initSelectionLookup();

  // immediately focus the sandbox input so user can start typing
  document.getElementById('word-input')?.focus();
});
