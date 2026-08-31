// Background service worker entry point for Spelt extension
// Delegates logic to modular, decoupled sub-modules

import { setupRules, registerContextMenu } from './background/rules.js';
import { listenSelectionActions } from './background/selection.js';
import { reviewWord } from './shared/storage.js';
import {
  cancelAiJob,
  getAiJobStatus,
  registerAiJobRecovery,
  startAiJob
} from './background/ai_jobs.js';

// Initialize rules and context menus
setupRules();
registerContextMenu();

// Listen for selection context menu and keyboard shortcuts
listenSelectionActions();
registerAiJobRecovery();

// Listen for message instructions (e.g. background translation refresh)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.action !== 'string') return false;

  if (message.action === 'startAiJob') {
    startAiJob(message.payload)
      .then(job => sendResponse({ success: true, job }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Could not start AI job.' }));
    return true;
  }
  if (message.action === 'cancelAiJob') {
    cancelAiJob(String(message.jobId || ''))
      .then(job => sendResponse({ success: true, job }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Could not cancel AI job.' }));
    return true;
  }
  if (message.action === 'getAiJobStatus') {
    getAiJobStatus()
      .then(job => sendResponse({ success: true, job }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Could not read AI job status.' }));
    return true;
  }
  if (message.action === 'reviewWord') {
    const wordId = typeof message.wordId === 'string' ? message.wordId.trim() : '';
    const score = Number(message.q);
    const mode = message.mode === 'recall' ? 'recall' : message.mode === 'spelling' ? 'spelling' : '';
    if (!wordId || !Number.isInteger(score) || score < 1 || score > 5 || !mode) {
      sendResponse({ success: false, error: 'Invalid review request.' });
      return false;
    }
    const responseTimeMs = Math.max(0, Math.min(Number(message.responseTimeMs) || 0, 60 * 60 * 1000));
    const typedWrongWord = typeof message.typedWrongWord === 'string'
      ? message.typedWrongWord.slice(0, 160)
      : '';
    reviewWord(wordId, message.q, typedWrongWord, responseTimeMs, mode)
      .then(updatedCard => sendResponse({ success: true, card: updatedCard }))
      .catch(err => sendResponse({ success: false, error: err.message || (typeof err === 'string' ? err : 'Background script error') }));
    return true; // Keep message channel open for async response
  }
  return false;
});
