// Background service worker entry point for Spelt extension
// Delegates logic to modular, decoupled sub-modules

import { startReloader } from './background/reloader.js';
import { runBackgroundRetranslate } from './background/retranslate.js';
import { setupRules, registerContextMenu } from './background/rules.js';
import { listenSelectionActions } from './background/selection.js';
import { reviewWord } from './shared/storage.js';

// Start hot-reloading loop during development
startReloader();

// Initialize rules and context menus
setupRules();
registerContextMenu();

// Listen for selection context menu and keyboard shortcuts
listenSelectionActions();

// Listen for message instructions (e.g. background translation refresh)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'retranslateAll') {
    runBackgroundRetranslate(message.targetLang).catch(err => console.error(err));
    sendResponse({ status: 'started' });
    return true;
  }
  if (message.action === 'reviewWord') {
    reviewWord(message.wordId, message.q, message.typedWrongWord, message.responseTimeMs)
      .then(updatedCard => sendResponse({ success: true, card: updatedCard }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});
