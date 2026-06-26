// Sandbox spelling verification controller orchestrator for Spelt extension popup
import { registerSandboxListeners } from './sandbox/listeners.js';

export function initSandbox(reloadVaultList, loadPracticeDeck) {
  registerSandboxListeners(reloadVaultList, loadPracticeDeck);
}
