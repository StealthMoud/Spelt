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

const DEV_RELOADER_SETTING_KEY = 'spelt_enable_dev_reloader';
const BASE_ONLINE_INTERVAL_MS = 1500;
const BASE_OFFLINE_INTERVAL_MS = 2500;
const MAX_OFFLINE_INTERVAL_MS = 30000;

let lastModifiedTimes = {};
let isServerOnline = false;
let consecutiveOfflineFailures = 0;
let reloaderTimerId = null;
let isStarted = false;

function withJitter(ms) {
  const factor = 0.85 + Math.random() * 0.30;
  return Math.max(1200, Math.round(ms * factor));
}

function getNextIntervalMs() {
  if (isServerOnline) {
    consecutiveOfflineFailures = 0;
    return withJitter(BASE_ONLINE_INTERVAL_MS);
  }

  const exp = Math.min(consecutiveOfflineFailures, 5);
  const backoff = Math.min(MAX_OFFLINE_INTERVAL_MS, BASE_OFFLINE_INTERVAL_MS * (2 ** exp));
  return withJitter(backoff);
}

function scheduleNextCheck(delayMs) {
  if (reloaderTimerId) clearTimeout(reloaderTimerId);
  reloaderTimerId = setTimeout(checkFilesForChanges, delayMs);
}

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
      consecutiveOfflineFailures += 1;
      break;
    }
  }

  if (changed) {
    console.log('Spelt: Source file change detected, reloading extension...');
    chrome.runtime.reload();
    return;
  }

  scheduleNextCheck(getNextIntervalMs());
}

export function startReloader() {
  if (isStarted) return;
  isStarted = true;

  const isDevMode = !('update_url' in chrome.runtime.getManifest());
  if (!chrome.storage?.local) {
    if (isDevMode) scheduleNextCheck(2000);
    return;
  }

  chrome.storage.local.get(DEV_RELOADER_SETTING_KEY, (res) => {
    const override = res?.[DEV_RELOADER_SETTING_KEY];
    const shouldRun = override === true || (override !== false && isDevMode);
    if (shouldRun) {
      scheduleNextCheck(2000);
    }
  });
}
