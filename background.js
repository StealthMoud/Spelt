// Background service worker for Spelt extension
// Implements zero-dependency local hot-reloading during development

import { getWords, saveWords, fetchTranslation, fetchDynamicExample, isFallbackExample, getFallbackExample, logDebug, fetchDynamicDefinition } from './shared/storage.js';

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
              urlFilter: "||dictionary.cambridge.org",
              resourceTypes: ["xmlhttprequest", "media"]
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
