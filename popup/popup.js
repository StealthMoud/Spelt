import { getWords, addWord } from '../shared/storage.js';
import { getSession } from '../shared/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const openDashBtn = document.getElementById('open-dash-btn');
  const dueCountEl = document.getElementById('due-count');
  const totalCountEl = document.getElementById('total-count');
  const quickForm = document.getElementById('quick-add-form');
  const wordInput = document.getElementById('word-input');
  const defInput = document.getElementById('def-input');
  const feedbackMsg = document.getElementById('feedback-msg');
  const userDisplay = document.getElementById('user-email-display');

  // Load and update popup statistics
  async function refreshStats() {
    try {
      const words = await getWords();
      const now = Date.now();
      const due = words.filter(w => w.nextDate <= now).length;
      
      dueCountEl.textContent = due;
      totalCountEl.textContent = words.length;
    } catch (e) {
      console.error('Failed to load spelt popup stats:', e);
    }
  }

  // Update user session layout
  async function checkSession() {
    const session = await getSession();
    if (session) {
      userDisplay.textContent = `Cloud Backup Active: ${session.email}`;
      userDisplay.style.color = 'var(--primary-light)';
    } else {
      userDisplay.textContent = 'Local Guest Profile';
      userDisplay.style.color = 'var(--text-muted)';
    }
  }

  // Open the full learning dashboard tab
  openDashBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    } else {
      // fallback for local testing in normal browser tab
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });

  // Handle Quick Add form submission
  quickForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = wordInput.value.trim();
    const definition = defInput.value.trim();

    if (!word) return;

    try {
      feedbackMsg.textContent = 'Adding...';
      feedbackMsg.style.color = 'var(--text-muted)';

      await addWord({ word, definition });

      feedbackMsg.textContent = `Added "${word}"!`;
      feedbackMsg.style.color = 'var(--success)';
      wordInput.value = '';
      defInput.value = '';

      await refreshStats();
      
      // Clear message after delay
      setTimeout(() => {
        feedbackMsg.textContent = '';
      }, 2500);

    } catch (err) {
      feedbackMsg.textContent = err.message || 'Error occurred';
      feedbackMsg.style.color = 'var(--success)'; // actually style red, let's fix color to primary-light/danger
      feedbackMsg.style.color = 'hsl(5, 80%, 55%)';
    }
  });

  // Initial runs
  await refreshStats();
  await checkSession();
});
