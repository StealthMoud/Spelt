import { addWord } from '../shared/storage.js';
import { showToastInTab } from './toast.js';

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

  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'add-selection-to-spelt') {
      try {
        const activeTab = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
        if (!activeTab || !activeTab.id) return;

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
}
