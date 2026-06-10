import { getWords, addWord } from '../shared/storage.js';
import { getSession, loginWithGoogle, logoutUser, syncUserData } from '../shared/auth.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely',
  'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'recieve': 'receive',
  'goverment': 'government', 'enviroment': 'environment',
  'pronounciation': 'pronunciation', 'calender': 'calendar'
};

const commonWords = [
  "accommodate", "definitely", "separate", "receive", "embarrass", "until",
  "government", "environment", "occurred", "threshold", "pronunciation",
  "calendar", "necessary", "writing", "colleague", "successful", "tomorrow"
];

document.addEventListener('DOMContentLoaded', async () => {
  const openDashBtn = document.getElementById('open-dash-btn');
  const dueCountEl = document.getElementById('due-count');
  const totalCountEl = document.getElementById('total-count');
  const quickForm = document.getElementById('quick-add-form');
  const wordInput = document.getElementById('word-input');
  const feedbackMsg = document.getElementById('feedback-msg');
  const userDisplay = document.getElementById('user-email-display');
  const statusDot = document.getElementById('popup-user-status-dot');
  const authBtn = document.getElementById('popup-auth-btn');
  const authBtnText = document.getElementById('popup-auth-btn-text');

  async function refreshStats() {
    try {
      const words = await getWords();
      const due = words.filter(w => w.nextDate <= Date.now()).length;
      dueCountEl.textContent = due;
      totalCountEl.textContent = words.length;
    } catch (e) {
      console.error(e);
    }
  }

  async function checkSession() {
    const session = await getSession();
    if (session) {
      userDisplay.textContent = `Sync Active: ${session.email}`;
      userDisplay.style.color = 'var(--primary-light)';
      statusDot.classList.add('active');
      authBtnText.textContent = 'Logout';
    } else {
      userDisplay.textContent = 'Local Guest Profile';
      userDisplay.style.color = 'var(--text-muted)';
      statusDot.classList.remove('active');
      authBtnText.textContent = 'Sync';
    }
  }

  openDashBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });

  authBtn.addEventListener('click', async () => {
    const session = await getSession();
    try {
      authBtn.disabled = true;
      if (session) {
        authBtnText.textContent = 'Logging out...';
        await logoutUser();
        await checkSession();
      } else {
        authBtnText.textContent = 'Syncing...';
        let email = '';
        if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
          const info = await new Promise(resolve => chrome.identity.getProfileUserInfo(resolve));
          email = info?.email;
        }
        if (email) {
          await loginWithGoogle(email);
          const words = await getWords();
          await syncUserData(words);
          await checkSession();
        } else {
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
          } else {
            window.open('../dashboard/dashboard.html', '_blank');
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      authBtn.disabled = false;
    }
  });

  quickForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = wordInput.value.trim();
    if (!word) return;

    try {
      feedbackMsg.style.display = 'block';
      feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';

      const lowerWord = word.toLowerCase();
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
      
      if (response.ok) {
        const data = await response.json();
        const def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
        const ipa = data[0].phonetics.find(p => p.text)?.text || '/--/';
        const ex = data[0].meanings[0]?.definitions[0]?.example || '';

        await addWord({ word, definition: def, transcription: ipa, example: ex });
        feedbackMsg.innerHTML = `
          <h4 style="color: var(--success);">✅ Correct Spelling!</h4>
          <p><strong>${word}</strong> ${ipa}</p>
          <p style="font-size: 0.72rem; color: var(--text-muted);">${def}</p>
        `;
        wordInput.value = '';
        await refreshStats();
        
        const session = await getSession();
        if (session) {
          const words = await getWords();
          await syncUserData(words);
        }
      } else {
        const suggestion = findSuggestion(lowerWord);
        if (suggestion) {
          feedbackMsg.innerHTML = `<p style="color: var(--primary-light);">Correcting spelling to "${suggestion}"...</p>`;
          const sRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
          let def = 'No definition found';
          let ipa = '/--/';
          let ex = '';
          if (sRes.ok) {
            const sData = await sRes.json();
            def = sData[0].meanings[0]?.definitions[0]?.definition || def;
            ipa = sData[0].phonetics.find(p => p.text)?.text || ipa;
            ex = sData[0].meanings[0]?.definitions[0]?.example || ex;
          }
          await addWord({ word: suggestion, definition: def, transcription: ipa, example: ex });
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--danger);">❌ Misspelled Word</h4>
            <p>"${word}" is incorrect. Did you mean <strong>${suggestion}</strong>?</p>
            <p style="font-size: 0.72rem; color: var(--text-muted);">Saved correct word to practice deck.</p>
          `;
          wordInput.value = '';
          await refreshStats();
          const session = await getSession();
          if (session) {
            const words = await getWords();
            await syncUserData(words);
          }
        } else {
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--danger);">❌ Spelling Error</h4>
            <p>"${word}" is not recognized as a word.</p>
          `;
        }
      }
    } catch (err) {
      feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`;
    }
  });

  function findSuggestion(word) {
    if (spellingMap[word]) return spellingMap[word];
    let best = null, min = 3;
    commonWords.forEach(correct => {
      const dist = getLevenshtein(word, correct);
      if (dist < min) { min = dist; best = correct; }
    });
    return best;
  }

  function getLevenshtein(a, b) {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1));
      }
    }
    return m[b.length][a.length];
  }

  await refreshStats();
  await checkSession();
});
