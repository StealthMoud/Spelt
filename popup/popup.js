import { getWords, addWord, registerMisspelling, saveWords } from '../shared/storage.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'recieve': 'receive', 'goverment': 'government', 'enviroment': 'environment',
  'pronounciation': 'pronunciation', 'calender': 'calendar'
};

const commonWords = [
  "accommodate", "definitely", "separate", "receive", "embarrass", "until", "government",
  "environment", "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing",
  "colleague", "successful", "tomorrow"
];

document.addEventListener('DOMContentLoaded', async () => {
  const openDashBtn = document.getElementById('open-dash-btn'), dueCountEl = document.getElementById('due-count');
  const totalCountEl = document.getElementById('total-count'), quickForm = document.getElementById('quick-add-form');
  const wordInput = document.getElementById('word-input'), feedbackMsg = document.getElementById('feedback-msg');

  async function refreshStats() {
    try {
      const words = await getWords();
      dueCountEl.textContent = words.filter(w => w.nextDate <= Date.now()).length;
      totalCountEl.textContent = words.length;
    } catch (e) { console.error(e); }
  }

  openDashBtn.addEventListener('click', () => {
    const url = typeof chrome !== 'undefined' && chrome.tabs ? chrome.runtime.getURL('dashboard/dashboard.html') : '../dashboard/dashboard.html';
    if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url }); else window.open(url, '_blank');
  });

  feedbackMsg.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-audio-url]');
    if (btn) {
      const url = btn.getAttribute('data-audio-url');
      if (url) new Audio(url).play().catch(err => console.error(err));
      return;
    }
    const saveBtn = e.target.closest('#manual-correction-btn');
    if (saveBtn) {
      const correctVal = document.getElementById('manual-correction-input')?.value.trim();
      const originalVal = saveBtn.getAttribute('data-original-word');
      if (correctVal && originalVal) await handleManualCorrection(correctVal, originalVal);
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
      const words = await getWords();
      const existing = words.find(w => w.word.toLowerCase() === lowerWord);

      if (existing) {
        if (existing.misspellings && existing.misspellings.length > 0) {
          existing.nextDate = Date.now() + 24 * 60 * 60 * 1000;
          await saveWords(words);
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correct Spelling!</h4>
            <p style="margin: 4px 0;">You previously misspelled <strong>${existing.word}</strong>.</p>
            <p style="font-size: 0.68rem; color: var(--primary-light); margin: 4px 0 0;">Scheduled for a follow-up review tomorrow to ensure it's fully learned.</p>
          `;
        } else {
          feedbackMsg.innerHTML = `<h4 style="color: var(--primary-light); margin: 0 0 4px;">Already Saved</h4><p style="font-size: 0.68rem; margin: 0;">"${existing.word}" is already in your Word Vault.</p>`;
        }
        wordInput.value = ''; await refreshStats(); return;
      }

      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
      if (response.ok) {
        const data = await response.json();
        const def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
        const ipa = data[0].phonetics.find(p => p.text)?.text || '/--/';
        const { us, uk } = extractAudios(data[0].phonetics);
        await addWord({ word, definition: def, transcription: ipa, nextDate: Date.now() + 365 * 24 * 60 * 60 * 1000 });
        feedbackMsg.innerHTML = `
          <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correct Spelling!</h4>
          <p style="margin: 4px 0;"><strong>${word}</strong> ${ipa}</p>
          ${renderAudioButtons(us, uk)}
          <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;">${def}</p>
        `;
        wordInput.value = ''; await refreshStats();
      } else {
        const suggestion = findSuggestion(lowerWord);
        if (suggestion) {
          feedbackMsg.innerHTML = `<p style="color: var(--primary-light);">Correcting spelling...</p>`;
          const sRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
          let def = 'No definition found', ipa = '/--/', { us, uk } = { us: '', uk: '' };
          if (sRes.ok) {
            const sData = await sRes.json();
            def = sData[0].meanings[0]?.definitions[0]?.definition || def;
            ipa = sData[0].phonetics.find(p => p.text)?.text || ipa;
            ({ us, uk } = extractAudios(sData[0].phonetics));
          }
          const card = await registerMisspelling(suggestion, word, { definition: def, transcription: ipa });
          const pastMsg = card.misspellings && card.misspellings.length > 1 ? `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 2px 0;"><strong>Past errors:</strong> ${card.misspellings.join(', ')}</p>` : '';
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Misspelled Word</h4>
            <p style="margin: 4px 0;">"${word}" is incorrect. Did you mean <strong>${suggestion}</strong>?</p>
            ${renderAudioButtons(us, uk)}${pastMsg}
            <p style="font-size: 0.68rem; color: var(--text-muted); margin: 4px 0 0;">Saved correct word to practice deck.</p>
          `;
          wordInput.value = ''; await refreshStats();
        } else {
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Spelling Error</h4>
            <p style="font-size: 0.72rem; margin: 0 0 8px;">"${word}" is not recognized. If you know the correct spelling, enter it below:</p>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="manual-correction-input" class="premium-input" placeholder="Correct spelling..." style="width: 140px; padding: 4px 8px; font-size: 0.75rem;">
              <button type="button" id="manual-correction-btn" data-original-word="${word}" class="submit-btn" style="width: 60px; padding: 4px; font-size: 0.75rem;">Save</button>
            </div>
          `;
        }
      }
    } catch (err) { feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`; }
  });

  async function handleManualCorrection(correctWord, originalWord) {
    try {
      feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(correctWord.toLowerCase())}`);
      if (response.ok) {
        const data = await response.json();
        const def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
        const ipa = data[0].phonetics.find(p => p.text)?.text || '/--/';
        const { us, uk } = extractAudios(data[0].phonetics);
        await registerMisspelling(correctWord, originalWord, { definition: def, transcription: ipa });
        feedbackMsg.innerHTML = `
          <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
          <p style="margin: 4px 0;">Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).</p>
          ${renderAudioButtons(us, uk)}
        `;
        wordInput.value = ''; await refreshStats();
      } else {
        feedbackMsg.innerHTML = `
          <h4 style="color: var(--danger);">❌ Word Not Found</h4>
          <p style="font-size: 0.72rem; margin: 0 0 8px;">"${correctWord}" is not recognized either.</p>
          <div style="display: flex; gap: 6px;">
            <input type="text" id="manual-correction-input" class="premium-input" placeholder="Correct spelling..." value="${correctWord}" style="width: 140px; padding: 4px 8px; font-size: 0.75rem;">
            <button type="button" id="manual-correction-btn" data-original-word="${originalWord}" class="submit-btn" style="width: 60px; padding: 4px; font-size: 0.75rem;">Save</button>
          </div>
        `;
      }
    } catch (err) { feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`; }
  }

  function extractAudios(ph) {
    const audios = ph ? ph.map(p => p.audio).filter(Boolean) : [];
    const us = audios.find(a => a.includes('-us') || a.includes('/us/')) || audios[0] || '';
    const uk = audios.find(a => a.includes('-uk') || a.includes('/uk/')) || audios[1] || us;
    return { us, uk };
  }

  function renderAudioButtons(us, uk) {
    const b = (u, l) => u ? `<button type="button" class="audio-play-btn" data-audio-url="${u}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${l}</span></button>` : '';
    return (us || uk) ? `<div style="display: flex; gap: 6px; margin: 8px 0 4px;">${b(us, 'US')}${b(uk, 'UK')}</div>` : '';
  }

  function findSuggestion(word) {
    if (spellingMap[word]) return spellingMap[word];
    let best = null, min = 3;
    commonWords.forEach(w => { const d = getLevenshtein(word, w); if (d < min) { min = d; best = w; } });
    return best;
  }

  function getLevenshtein(a, b) {
    const r = Array(b.length + 1).fill(0).map((_, i) => [i]);
    for (let j = 0; j <= a.length; j++) r[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) r[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? r[i - 1][j - 1] : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
    }
    return r[b.length][a.length];
  }

  await refreshStats();
});
