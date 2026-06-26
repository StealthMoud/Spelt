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
      isServerOnline = false;
      break;
    }
  }

  if (changed) {
    console.log('Spelt: Source file change detected, reloading extension...');
    chrome.runtime.reload();
    return;
  }

  const nextInterval = isServerOnline ? 1500 : 10000;
  setTimeout(checkFilesForChanges, nextInterval);
}

export function startReloader() {
  const isDevMode = !('update_url' in chrome.runtime.getManifest());
  if (isDevMode) {
    setTimeout(checkFilesForChanges, 2000);
  }
}
