// Background service worker for Spelt extension
// Implements zero-dependency local hot-reloading during development

const FILES_TO_WATCH = [
  'http://localhost:8080/manifest.json',
  'http://localhost:8080/popup/popup.html',
  'http://localhost:8080/popup/popup.css',
  'http://localhost:8080/popup/popup.js'
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
