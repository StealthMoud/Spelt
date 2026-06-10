import { addWord, addXp, registerMisspelling, getWords, saveWords } from '../../shared/storage.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'seperated': 'separate', 'recieve': 'receive', 'receved': 'receive', 'embarass': 'embarrass',
  'embaras': 'embarrass', 'untill': 'until', 'goverment': 'government', 'enviroment': 'environment',
  'ocured': 'occurred', 'treshold': 'threshold', 'pronounciation': 'pronunciation', 'calender': 'calendar',
  'necesary': 'necessary', 'writting': 'writing', 'collegue': 'colleague'
};

const commonWords = [
  "accommodate", "definitely", "separate", "receive", "embarrass", "until", "government", "environment",
  "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing", "colleague", "independent",
  "successful", "tomorrow", "achievement", "experience", "beautiful", "business", "knowledge", "possession"
];

let onXpUpdatedCallback = null, triggerConfettiFn = null;

export function initSandbox(onXpUpdated, triggerConfetti) {
  onXpUpdatedCallback = onXpUpdated; triggerConfettiFn = triggerConfetti;
  const inputField = document.getElementById('sandbox-spell-input');
  if (inputField) inputField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerify(); } });
  const feedback = document.getElementById('sandbox-feedback');
  if (feedback) {
    feedback.addEventListener('click', async (e) => {
      const playBtn = e.target.closest('[data-audio-url]');
      if (playBtn) {
        const url = playBtn.getAttribute('data-audio-url');
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
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === lowerWord);
    if (existing) {
      if (existing.misspellings && existing.misspellings.length > 0) {
        existing.nextDate = Date.now() + 24 * 60 * 60 * 1000;
        await saveWords(words);
        feedback.innerHTML = `
          <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correct Spelling!</h4>
          <p style="font-size: 1.1rem; font-weight: 600; margin: 4px 0;">${existing.word}</p>
          <p style="font-size: 0.8rem; line-height: 1.4; margin: 4px 0;">You previously misspelled this word (${existing.misspellings.join(', ')}).</p>
          <p style="font-size: 0.75rem; color: var(--primary-light); font-weight: 600; margin: 8px 0 0;">Scheduled for a follow-up review tomorrow to ensure it's fully learned.</p>
        `;
      } else {
        feedback.innerHTML = `<h4 style="color: var(--primary-light); margin: 0 0 4px;">Already Saved</h4><p style="font-size: 0.8rem; line-height: 1.4; margin: 0;">"${existing.word}" is already in your Word Vault.</p>`;
      }
      if (inputField) inputField.value = '';
      return;
    }
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
    if (response.ok) {
      const data = await response.json();
      await handleCorrectSpelling(data[0], word);
    } else {
      const suggestion = findSpellingSuggestion(lowerWord);
      await handleMisspelling(word, suggestion);
    }
  } catch (err) { feedback.innerHTML = `<p style="color: var(--danger);">Verification error: ${err.message}</p>`; }
}

async function handleCorrectSpelling(apiData, word) {
  const def = apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  const ipa = apiData.phonetics.find(p => p.text)?.text || '/--/';
  const { us, uk } = extractAudios(apiData.phonetics);
  try {
    await addWord({ word, definition: def, transcription: ipa, nextDate: Date.now() + 365 * 24 * 60 * 60 * 1000 });
    await addXp(10);
    if (onXpUpdatedCallback) onXpUpdatedCallback();
    if (triggerConfettiFn) triggerConfettiFn(document.getElementById('sandbox-spell-input'));
    document.getElementById('sandbox-feedback').innerHTML = `
      <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correct Spelling!</h4>
      <p style="font-size: 1.1rem; font-weight: 600; margin: 4px 0;">${word} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">${ipa}</span></p>
      ${renderAudioButtons(us, uk)}
      <p style="font-size: 0.8rem; line-height: 1.4; margin: 4px 0;"><strong>Meaning:</strong> ${def}</p>
      <p style="font-size: 0.75rem; color: var(--success); font-weight: 600; margin: 8px 0 0;">Earned +10 XP! Saved to database (hidden from reviews).</p>
    `;
    document.getElementById('sandbox-spell-input').value = '';
  } catch (err) {
    document.getElementById('sandbox-feedback').innerHTML = `<h4 style="color: var(--primary-light); margin: 0 0 4px;">Already Saved</h4><p style="font-size: 0.8rem; line-height: 1.4; margin: 0;">"${word}" is already in your Word Vault.</p>`;
  }
}

async function handleMisspelling(word, suggestion) {
  const feedback = document.getElementById('sandbox-feedback');
  if (suggestion) {
    feedback.innerHTML = `<p style="color: var(--primary-light);">Correcting spelling...</p>`;
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
    let def = 'No definition found', ipa = '/--/', { us, uk } = { us: '', uk: '' };
    if (response.ok) {
      const data = await response.json();
      def = data[0].meanings[0]?.definitions[0]?.definition || def;
      ipa = data[0].phonetics.find(p => p.text)?.text || ipa;
      ({ us, uk } = extractAudios(data[0].phonetics));
    }
    const card = await registerMisspelling(suggestion, word, { definition: def, transcription: ipa });
    await addXp(2); if (onXpUpdatedCallback) onXpUpdatedCallback();
    const pastMsg = card.misspellings && card.misspellings.length > 1 ? `<p style="font-size: 0.75rem; color: var(--text-muted); margin: 4px 0;"><strong>Past errors:</strong> ${card.misspellings.join(', ')}</p>` : '';
    feedback.innerHTML = `
      <h4 style="color: var(--danger); margin: 0 0 6px;">❌ Misspelling Detected</h4>
      <p style="font-size: 0.8rem; margin: 4px 0;">"${word}" is incorrect. Did you mean <strong style="color: var(--primary-light);">${suggestion}</strong>?</p>
      ${renderAudioButtons(us, uk)}${pastMsg}
      <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0;">Added correct word <strong>"${suggestion}"</strong> to practice queue.</p>
      <p style="font-size: 0.75rem; color: var(--primary-light); font-weight: 600; margin: 8px 0 0;">Earned +2 XP (Effort points).</p>
    `;
    document.getElementById('sandbox-spell-input').value = '';
  } else {
    feedback.innerHTML = `
      <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Spelling Error</h4>
      <p style="font-size: 0.8rem; margin: 0 0 8px;">"${word}" is not recognized. If you know the correct spelling, enter it below:</p>
      <div style="display: flex; gap: 8px;">
        <input type="text" id="manual-correction-input" class="premium-input" placeholder="Type correct spelling..." style="width: 180px; padding: 6px 10px; font-size: 0.8rem;">
        <button type="button" id="manual-correction-btn" data-original-word="${word}" class="action-btn" style="padding: 6px 12px; font-size: 0.8rem;">Save</button>
      </div>
    `;
  }
}

async function handleManualCorrection(correctWord, originalWord) {
  const feedback = document.getElementById('sandbox-feedback');
  try {
    feedback.innerHTML = '<p style="color: var(--primary-light);">Verifying dictionary records...</p>';
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(correctWord.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      const def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      const ipa = data[0].phonetics.find(p => p.text)?.text || '/--/';
      const { us, uk } = extractAudios(data[0].phonetics);
      await registerMisspelling(correctWord, originalWord, { definition: def, transcription: ipa });
      await addXp(10); if (onXpUpdatedCallback) onXpUpdatedCallback();
      if (triggerConfettiFn) triggerConfettiFn(document.getElementById('sandbox-spell-input'));
      feedback.innerHTML = `
        <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correction Saved!</h4>
        <p style="font-size: 1.1rem; font-weight: 600; margin: 4px 0;">${correctWord} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">${ipa}</span></p>
        ${renderAudioButtons(us, uk)}
        <p style="font-size: 0.8rem; line-height: 1.4; margin: 4px 0;"><strong>Meaning:</strong> ${def}</p>
        <p style="font-size: 0.75rem; color: var(--success); font-weight: 600; margin: 8px 0 0;">Earned +10 XP! Added to vault for SRS practice.</p>
      `;
      document.getElementById('sandbox-spell-input').value = '';
    } else {
      feedback.innerHTML = `
        <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Word Not Found</h4>
        <p style="font-size: 0.8rem; margin: 0 0 8px;">"${correctWord}" is not recognized in the dictionary either.</p>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="manual-correction-input" class="premium-input" placeholder="Type correct spelling..." value="${correctWord}" style="width: 180px; padding: 6px 10px; font-size: 0.8rem;">
          <button type="button" id="manual-correction-btn" data-original-word="${originalWord}" class="action-btn" style="padding: 6px 12px; font-size: 0.8rem;">Save</button>
        </div>
      `;
    }
  } catch (err) { feedback.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`; }
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

function findSpellingSuggestion(word) {
  if (spellingMap[word]) return spellingMap[word];
  let best = null, min = 3;
  commonWords.forEach(w => { const d = getLevenshteinDistance(word, w); if (d < min) { min = d; best = w; } });
  return best;
}

function getLevenshteinDistance(a, b) {
  const m = Array(b.length + 1).fill().map((_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  }
  return m[b.length][a.length];
}
