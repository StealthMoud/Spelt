// Background service worker for Spelt extension
// Implements zero-dependency local hot-reloading during development

import { getWords, saveWords, fetchTranslation } from './shared/storage.js';

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
    if (words.length === 0) return;

    // Process in batches of 5 to avoid hitting API rate limits
    const batchSize = 5;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      await Promise.all(batch.map(async (w) => {
        try {
          // Fetch translation using Google Translate
          const translation = await fetchTranslation(w.word, targetLang);
          if (translation) w.translation = translation;

          // Fetch dictionary definition, transcription, example
          const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.word.toLowerCase())}`);
          if (response.ok) {
            const data = await response.json();
            const first = data[0];
            if (first) {
              const def = first.meanings[0]?.definitions[0]?.definition;
              if (def) w.definition = def;

              const ipa = first.phonetics.find(p => p.text)?.text;
              if (ipa) w.transcription = ipa;

              const pos = first.meanings[0]?.partOfSpeech;
              if (pos) w.partOfSpeech = pos;

              let example = '';
              if (first.meanings) {
                outerLoop: for (const m of first.meanings) {
                  if (m.definitions) {
                    for (const d of m.definitions) {
                      if (d.example) {
                        example = d.example.trim();
                        break outerLoop;
                      }
                    }
                  }
                }
              }
              if (example) w.example = example;
            }
          }
        } catch (err) {
          console.error(`Error refreshing "${w.word}" in background:`, err);
        }
      }));
      // brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    await saveWords(words);
    
    // Notify the popup if it is open (fails silently if popup is closed)
    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background retranslate failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}
