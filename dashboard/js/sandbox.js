import { addWord, addXp } from '../../shared/storage.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'seperated': 'separate', 'recieve': 'receive', 'receved': 'receive', 'embarass': 'embarrass',
  'embaras': 'embarrass', 'untill': 'until', 'goverment': 'government', 'enviroment': 'environment',
  'ocured': 'occurred', 'treshold': 'threshold', 'pronounciation': 'pronunciation', 'calender': 'calendar',
  'necesary': 'necessary', 'writting': 'writing', 'collegue': 'colleague'
};

const commonWords = [
  "accommodate", "definitely", "separate", "receive", "embarrass", "until", "government",
  "environment", "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing",
  "colleague", "independent", "successful", "tomorrow", "achievement", "experience", "beautiful",
  "business", "knowledge", "possession"
];

let onXpUpdatedCallback = null;
let triggerConfettiFn = null;

export function initSandbox(onXpUpdated, triggerConfetti) {
  onXpUpdatedCallback = onXpUpdated;
  triggerConfettiFn = triggerConfetti;

  const inputField = document.getElementById('sandbox-spell-input');
  if (inputField) {
    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      }
    });
  }

  const feedback = document.getElementById('sandbox-feedback');
  if (feedback) {
    feedback.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-audio-url]');
      if (btn) {
        const url = btn.getAttribute('data-audio-url');
        if (url) new Audio(url).play().catch(err => console.error(err));
      }
    });
  }
}

async function handleVerify() {
  const inputField = document.getElementById('sandbox-spell-input');
  const feedback = document.getElementById('sandbox-feedback');
  const word = inputField?.value.trim();
  if (!word) return;

  try {
    feedback.style.display = 'block';
    feedback.innerHTML = '<p style="color: var(--primary-light);">Verifying dictionary records...</p>';

    const lowerWord = word.toLowerCase();
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
    
    if (response.ok) {
      const data = await response.json();
      await handleCorrectSpelling(data[0], word);
    } else {
      const suggestion = findSpellingSuggestion(lowerWord);
      await handleMisspelling(word, suggestion);
    }
  } catch (err) {
    feedback.innerHTML = `<p style="color: var(--danger);">Verification error: ${err.message}</p>`;
  }
}

async function handleCorrectSpelling(apiData, word) {
  const feedback = document.getElementById('sandbox-feedback');
  const def = apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  const ipa = apiData.phonetics.find(p => p.text)?.text || '/--/';
  const ex = apiData.meanings[0]?.definitions[0]?.example || '';
  const { us, uk } = extractAudios(apiData.phonetics);
  const audioHtml = renderAudioButtons(us, uk);

  try {
    await addWord({ word, definition: def, transcription: ipa, example: ex });
    await addXp(10);
    
    if (onXpUpdatedCallback) onXpUpdatedCallback();
    if (triggerConfettiFn) triggerConfettiFn(document.getElementById('sandbox-spell-input'));

    feedback.innerHTML = `
      <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correct Spelling!</h4>
      <p style="font-size: 1.1rem; font-weight: 600; margin: 4px 0;">${word} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">${ipa}</span></p>
      ${audioHtml}
      <p style="font-size: 0.8rem; line-height: 1.4; margin: 4px 0;"><strong>Meaning:</strong> ${def}</p>
      <p style="font-size: 0.75rem; color: var(--success); font-weight: 600; margin: 8px 0 0;">Earned +10 XP! Added to vault.</p>
    `;
  } catch (err) {
    feedback.innerHTML = `
      <h4 style="color: var(--primary-light); margin: 0 0 4px;">Already Saved</h4>
      <p style="font-size: 0.8rem; line-height: 1.4; margin: 0;">"${word}" is already in your Word Vault.</p>
    `;
  }
}

async function handleMisspelling(word, suggestion) {
  const feedback = document.getElementById('sandbox-feedback');
  
  if (suggestion) {
    feedback.innerHTML = `<p style="color: var(--primary-light);">Correcting spelling...</p>`;
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
    let def = 'No definition found', ipa = '/--/', ex = '', audioHtml = '';
    
    if (response.ok) {
      const data = await response.json();
      def = data[0].meanings[0]?.definitions[0]?.definition || def;
      ipa = data[0].phonetics.find(p => p.text)?.text || ipa;
      ex = data[0].meanings[0]?.definitions[0]?.example || ex;
      const { us, uk } = extractAudios(data[0].phonetics);
      audioHtml = renderAudioButtons(us, uk);
    }

    try {
      await addWord({ word: suggestion, definition: def, transcription: ipa, example: ex });
    } catch (e) {}

    await addXp(2);
    if (onXpUpdatedCallback) onXpUpdatedCallback();

    feedback.innerHTML = `
      <h4 style="color: var(--danger); margin: 0 0 6px;">❌ Misspelling Detected</h4>
      <p style="font-size: 0.8rem; line-height: 1.4; margin: 4px 0;">
        "${word}" is incorrect. Did you mean <strong style="color: var(--primary-light);">${suggestion}</strong>?
      </p>
      ${audioHtml}
      <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin: 4px 0;">
        We saved <strong>"${suggestion}"</strong> as a due card in your SRS queue to practice spelling it.
      </p>
      <p style="font-size: 0.75rem; color: var(--primary-light); font-weight: 600; margin: 8px 0 0;">Earned +2 XP (Effort points).</p>
    `;
  } else {
    feedback.innerHTML = `
      <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Spelling Error</h4>
      <p style="font-size: 0.8rem; line-height: 1.4; margin: 0;">"${word}" is not a recognized English word, and we couldn't find suggestions.</p>
    `;
  }
}

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

function findSpellingSuggestion(word) {
  if (spellingMap[word]) return spellingMap[word];
  let bestMatch = null, minDistance = 3;
  commonWords.forEach(correct => {
    const dist = getLevenshteinDistance(word, correct);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = correct;
    }
  });
  return bestMatch;
}

function getLevenshteinDistance(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}
