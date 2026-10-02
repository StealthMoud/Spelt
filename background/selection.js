import { addWord } from '../shared/storage.js';
import { showToastInTab } from './toast.js';

export async function captureSelectedText(tab) {
  // Chrome can omit tab.url for an extension page even when it is our own.
  const ownContexts = chrome.runtime.getContexts
    ? await chrome.runtime.getContexts({ contextTypes: ['TAB'], tabIds: [tab.id] })
    : [];
  if (tab.url?.startsWith(chrome.runtime.getURL('')) || ownContexts.length > 0) {
    const response = await chrome.runtime.sendMessage({ action: 'readSpeltSelection', tabId: tab.id });
    return response?.text || '';
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const selected = window.getSelection()?.toString() || '';
      if (selected) return selected;
      const focused = document.activeElement;
      if (focused && typeof focused.selectionStart === 'number' && typeof focused.value === 'string') {
        return focused.value.slice(focused.selectionStart, focused.selectionEnd);
      }
      return window.getSelection()?.toString() || '';
    }
  });
  return results?.[0]?.result || '';
}

export function selectionAccessMessage(tab, error) {
  if (tab?.url?.startsWith('file://')) {
    return 'For local files, enable "Allow access to file URLs" in Spelt’s details at chrome://extensions, then try again.';
  }
  if (/^(chrome:|edge:|about:|chrome-extension:)/.test(tab?.url || '') || /extensions gallery|web store|restricted|cannot access a chrome/i.test(error.message || '')) {
    return 'Chrome blocks selection shortcuts on this page. Copy the word and paste it into Spelt’s Discover tab to save it.';
  }
  if (/cannot access|permission/i.test(error.message || '')) {
    return 'Spelt could not read this page. Reload Spelt at chrome://extensions and refresh the page. For a PDF or restricted page, copy the word into Discover.';
  }
  return error.message || 'Failed to capture selection. Copy the word into Discover to save it.';
}

async function addSelectedWord(cleanWord, tab) {
  try {
    await addWord({ word: cleanWord });

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

export function listenSelectionActions() {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-spelt') {
      const selectedText = (info.selectionText || '').trim();
      if (!selectedText) return;

      const cleanWord = selectedText.replace(/[^a-zA-Z0-9'\-\s]/g, '').trim();
      if (!cleanWord) return;

      await addSelectedWord(cleanWord, tab);
    }
  });

  chrome.commands.onCommand.addListener(handleSelectionShortcut);
}

export async function handleSelectionShortcut(command, tab) {
  if (command === 'add-selection-to-spelt') {
    let activeTab = tab;
    try {
      activeTab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
      if (!activeTab || !activeTab.id) return;

      const selectedText = (await captureSelectedText(activeTab)).trim();
      if (!selectedText) {
        await showToastInTab(activeTab.id, 'Please select some text first!', false);
        return;
      }

      const cleanWord = selectedText.replace(/[^a-zA-Z0-9'\-\s]/g, '').trim();
      if (!cleanWord) return;

      await addSelectedWord(cleanWord, activeTab);
    } catch (err) {
      // Page-access failures are expected on protected browser/PDF pages.
      if (!/cannot access|restricted|permission|file:\/\//i.test(err.message || '')) {
        console.error('Error handling selection shortcut:', err);
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Spelt Shortcut Error',
        message: selectionAccessMessage(activeTab, err)
      }).catch(() => {});
    }
  }
}
