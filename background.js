// Background service worker for Spelt extension
// Implements zero-dependency local hot-reloading during development

import { getWords, saveWords, fetchTranslation, fetchDynamicExample, isFallbackExample, getFallbackExample, logDebug, fetchDynamicDefinition, addWord } from './shared/storage.js';

const FILES_TO_WATCH = [
  'http://localhost:8080/manifest.json',
  'http://localhost:8080/popup/popup.html',
  'http://localhost:8080/popup/popup.css',
  'http://localhost:8080/popup/popup.js',
  'http://localhost:8080/popup/js/navigation.js',
  'http://localhost:8080/popup/js/practice.js',
  'http://localhost:8080/popup/js/sandbox.js',
  'http://localhost:8080/popup/js/vault.js',
  'http://localhost:8080/popup/js/settings.js',
  'http://localhost:8080/shared/storage.js'
];

let lastModifiedTimes = {};
let checkInterval = 1500; // 1.5 seconds when dev server is online
let isServerOnline = false;

async function checkFilesForChanges() {
  let changed = false;

  for (const url of FILES_TO_WATCH) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      isServerOnline = true;
      const lastMod = res.headers.get('Last-Modified');
      
      if (lastMod) {
        if (lastModifiedTimes[url] && lastModifiedTimes[url] !== lastMod) {
          changed = true;
        }
        lastModifiedTimes[url] = lastMod;
      }
    } catch (err) {
      // Server is offline or connection refused
      isServerOnline = false;
      break;
    }
  }

  if (changed) {
    console.log('Spelt: Source file change detected, reloading extension...');
    chrome.runtime.reload();
    return;
  }

  // Adjust polling frequency based on server status
  const nextInterval = isServerOnline ? 1500 : 10000;
  setTimeout(checkFilesForChanges, nextInterval);
}

// Only start hot-reloading if we are loaded as an unpacked developer extension
const isDevMode = !('update_url' in chrome.runtime.getManifest());
if (isDevMode) {
  // Let the extension initialize before starting the loop
  setTimeout(checkFilesForChanges, 2000);
}

// Handle re-translating and refreshing all words in background task thread
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'retranslateAll') {
    runBackgroundRetranslate(message.targetLang).catch(err => console.error(err));
    sendResponse({ status: 'started' });
    return true;
  }
});

async function runBackgroundRetranslate(targetLang) {
  try {
    const words = await getWords();
    await logDebug({ type: 'start', count: words.length, targetLang });
    if (words.length === 0) return;

    // Process in batches of 5 to avoid hitting API rate limits
    const batchSize = 5;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      await Promise.all(batch.map(async (w) => {
        try {
          const originalEx = w.example;
          const isFallback = isFallbackExample(w.word, w.example);
          
          // Fetch translation using Google Translate
          const translation = await fetchTranslation(w.word, targetLang);
          if (translation) w.translation = translation;

          // Fetch dictionary definition, transcription, example
          let dictDef = '';
          let dictEx = '';
          const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.word.toLowerCase())}`);
          const dictOk = response.ok;
          if (response.ok) {
            const data = await response.json();
            const first = data[0];
            if (first) {
              const def = first.meanings[0]?.definitions[0]?.definition;
              if (def) dictDef = def;

              const ipa = first.phonetics.find(p => p.text)?.text;
              if (ipa) w.transcription = ipa;

              const pos = first.meanings[0]?.partOfSpeech;
              if (pos) w.partOfSpeech = pos;

              if (first.meanings) {
                outerLoop: for (const m of first.meanings) {
                  if (m.definitions) {
                    for (const d of m.definitions) {
                      if (d.example) {
                        dictEx = d.example.trim();
                        break outerLoop;
                      }
                    }
                  }
                }
              }
            }
          }

          // Always try to fetch a premium dynamic definition first
          let newDef = await fetchDynamicDefinition(w.word);
          if (!newDef) {
            newDef = dictDef;
          }
          if (newDef) {
            w.definition = newDef;
          }

          // Always try to fetch a premium dynamic example from Cambridge/Oxford/Tatoeba first
          let newExample = await fetchDynamicExample(w.word);
          if (!newExample) {
            newExample = dictEx;
          }
          if (!newExample && (!w.example || isFallbackExample(w.word, w.example))) {
            newExample = getFallbackExample(w.word, w.partOfSpeech || '');
          }

          if (newExample) {
            w.example = newExample;
          }

          await logDebug({
            word: w.word,
            dictOk,
            isFallback,
            originalEx,
            newEx: w.example
          });
        } catch (err) {
          await logDebug({ word: w.word, error: err.message });
          console.error(`Error refreshing "${w.word}" in background:`, err);
        }
      }));
      // brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    await saveWords(words);
    await logDebug({ type: 'completed', count: words.length });
    
    // Notify the popup if it is open (fails silently if popup is closed)
    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background retranslate failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}

// Register dynamic declarativeNetRequest header rules for Cambridge Dictionary CORS/403 bypass
async function setupRules() {
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(r => r.id);
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                { header: "Origin", operation: "remove" },
                { header: "Referer", operation: "set", value: "https://dictionary.cambridge.org/" },
                { header: "Sec-Fetch-Mode", operation: "remove" },
                { header: "Sec-Fetch-Site", operation: "remove" }
              ]
            },
            condition: {
              urlFilter: "||dictionary.cambridge.org"
            }
          }
        ]
      });
      console.log("Spelt: Registered declarativeNetRequest header rules for Cambridge Dictionary.");
    } catch (err) {
      console.error("Spelt: Failed to register declarativeNetRequest rules:", err);
    }
  }
}
setupRules();

// Register Spelt context menu item for selected text
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-spelt',
    title: 'Add "%s" to Spelt Vault',
    contexts: ['selection']
  });
});

// Reusable helper to display a premium, non-intrusive Glassmorphic toast in the tab, falling back to chrome.notifications if injection is blocked.
async function showToastInTab(tabId, message, isSuccess = true) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, success) => {
        let container = document.getElementById('spelt-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'spelt-toast-container';
          container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          `;
          document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.cssText = `
          background: rgba(16, 20, 24, 0.94);
          border: 1px solid ${success ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'};
          color: #ffffff;
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px ${success ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          gap: 8px;
          transform: translateY(-20px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
        `;

        const iconSvg = success 
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

        toast.innerHTML = `
          ${iconSvg}
          <span style="font-family: inherit;">${msg}</span>
        `;

        container.appendChild(toast);

        // trigger reflow
        toast.offsetHeight;

        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';

        setTimeout(() => {
          toast.style.transform = 'translateY(-20px)';
          toast.style.opacity = '0';
          setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
              container.remove();
            }
          }, 300);
        }, 3000);
      },
      args: [message, isSuccess]
    });
  } catch (err) {
    console.warn('Could not inject toast, falling back to chrome.notifications:', err);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: isSuccess ? 'Added to Spelt Vault' : 'Spelt Vault Error',
      message: message
    });
  }
}

// Helper to add word selection to the DB and show toast/send messages
async function addSelectedWord(cleanWord, tab) {
  try {
    // Add word to database, triggering dictionary detail retrieval automatically
    await addWord({ word: cleanWord });

    // Notify the user of successful addition
    if (tab && tab.id) {
      await showToastInTab(tab.id, `"${cleanWord}" added to Spelt Vault!`, true);
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Added to Spelt Vault',
        message: `"${cleanWord}" has been successfully added to your Vault!`
      });
    }
    
    // Notify popup to refresh if it's open
    chrome.runtime.sendMessage({ action: 'wordAddedFromContextMenu', word: cleanWord }).catch(() => {});
  } catch (err) {
    console.error('Error adding word:', err);
    
    let message = 'Failed to add word to Vault.';
    if (err.message && err.message.includes('already exists')) {
      message = `"${cleanWord}" is already in your Vault.`;
    } else if (err.message) {
      message = err.message;
    }

    if (tab && tab.id) {
      await showToastInTab(tab.id, message, false);
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Spelt Vault',
        message: message
      });
    }
  }
}

// Handle context menu click events
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-spelt') {
    const selectedText = (info.selectionText || '').trim();
    if (!selectedText) return;

    // Clean punctuation and normalize spelling
    const cleanWord = selectedText.replace(/[^a-zA-Z0-9'\-\s]/g, '').trim();
    if (!cleanWord) return;

    await addSelectedWord(cleanWord, tab);
  }
});

// Handle custom command keyboard shortcut (e.g. Alt+A / Option+A)
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'add-selection-to-spelt') {
    try {
      const activeTab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      if (!activeTab || !activeTab.id) return;

      // Run selection script in the active tab to extract highlighted text
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => window.getSelection().toString()
      });

      if (!results || !results[0]) return;
      const selectedText = (results[0].result || '').trim();
      if (!selectedText) {
        await showToastInTab(activeTab.id, 'Please select some text first!', false);
        return;
      }

      const cleanWord = selectedText.replace(/[^a-zA-Z0-9'\-\s]/g, '').trim();
      if (!cleanWord) return;

      await addSelectedWord(cleanWord, activeTab);
    } catch (err) {
      console.error('Error handling selection shortcut:', err);
      const isFileOrRestricted = err.message && (
        err.message.includes('Cannot access') || 
        err.message.includes('restricted') || 
        err.message.includes('file://')
      );
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Spelt Shortcut Error',
        message: isFileOrRestricted 
          ? 'To use shortcuts on local pages (file://), please toggle "Allow access to file URLs" in Spelt details on chrome://extensions.'
          : (err.message || 'Failed to capture selection.')
      });
    }
  }
});
