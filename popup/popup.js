import { getWords, addWord } from '../shared/storage.js';

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
  const openDashBtn = document.getElementById('open-dash-btn');
  const dueCountEl = document.getElementById('due-count');
  const totalCountEl = document.getElementById('total-count');
  const quickForm = document.getElementById('quick-add-form');
  const wordInput = document.getElementById('word-input');
  const feedbackMsg = document.getElementById('feedback-msg');


  async function refreshStats() {
    try {
      const words = await getWords();
      dueCountEl.textContent = words.filter(w => w.nextDate <= Date.now()).length;
      totalCountEl.textContent = words.length;
    } catch (e) { console.error(e); }
  }



  openDashBtn.addEventListener('click', () => {
    const url = typeof chrome !== 'undefined' && chrome.tabs ? chrome.runtime.getURL('dashboard/dashboard.html') : '../dashboard/dashboard.html';
    if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url });
    else window.open(url, '_blank');
  });



  feedbackMsg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-audio-url]');
    if (btn) {
      const url = btn.getAttribute('data-audio-url');
      if (url) new Audio(url).play().catch(err => console.error(err));
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
        const { us, uk } = extractAudios(data[0].phonetics);
        const audioHtml = renderAudioButtons(us, uk);

        await addWord({ word, definition: def, transcription: ipa, example: ex });
        feedbackMsg.innerHTML = `
          <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correct Spelling!</h4>
          <p style="margin: 4px 0;"><strong>${word}</strong> ${ipa}</p>
          ${audioHtml}
          <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;">${def}</p>
        `;
        wordInput.value = '';
        await refreshStats();

      } else {
        const suggestion = findSuggestion(lowerWord);
        if (suggestion) {
          feedbackMsg.innerHTML = `<p style="color: var(--primary-light);">Correcting spelling...</p>`;
          const sRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
          let def = 'No definition found', ipa = '/--/', ex = '', audioHtml = '';
          if (sRes.ok) {
            const sData = await sRes.json();
            def = sData[0].meanings[0]?.definitions[0]?.definition || def;
            ipa = sData[0].phonetics.find(p => p.text)?.text || ipa;
            ex = sData[0].meanings[0]?.definitions[0]?.example || ex;
            const { us, uk } = extractAudios(sData[0].phonetics);
            audioHtml = renderAudioButtons(us, uk);
          }
          await addWord({ word: suggestion, definition: def, transcription: ipa, example: ex });
          feedbackMsg.innerHTML = `
            <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Misspelled Word</h4>
            <p style="margin: 4px 0;">"${word}" is incorrect. Did you mean <strong>${suggestion}</strong>?</p>
            ${audioHtml}
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;">Saved correct word to practice deck.</p>
          `;
          wordInput.value = '';
          await refreshStats();

        } else {
          feedbackMsg.innerHTML = `<h4 style="color: var(--danger);">❌ Spelling Error</h4><p>"${word}" is not recognized.</p>`;
        }
      }
    } catch (err) {
      feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`;
    }
  });

  function extractAudios(phonetics) {
    let us = '', uk = '';
    if (!phonetics) return { us, uk };
    for (const p of phonetics) {
      if (p.audio) {
        if (p.audio.includes('-us.mp3') || p.audio.includes('/us/')) us = p.audio;
        else if (p.audio.includes('-uk.mp3') || p.audio.includes('/uk/')) uk = p.audio;
      }
    }
    const all = phonetics.filter(p => p.audio).map(p => p.audio);
    if (all.length > 0) {
      if (!us) us = all[0];
      if (!uk) uk = all[1] || all[0];
    }
    return { us, uk };
  }

  function renderAudioButtons(us, uk) {
    let html = '';
    if (us) html += `<button type="button" class="audio-play-btn" data-audio-url="${us}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>US</span></button>`;
    if (uk) html += `<button type="button" class="audio-play-btn" data-audio-url="${uk}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>UK</span></button>`;
    return html ? `<div style="display: flex; gap: 6px; margin: 8px 0 4px;">${html}</div>` : '';
  }

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
    const r = Array(b.length + 1).fill(0).map((_, i) => [i]);
    for (let j = 0; j <= a.length; j++) r[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        r[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? r[i - 1][j - 1] : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
      }
    }
    return r[b.length][a.length];
  }

  await refreshStats();
});
