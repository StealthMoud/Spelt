import { getWords, addWord, registerMisspelling, saveWords, addXp } from '../../shared/storage.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'recieve': 'receive', 'goverment': 'government', 'enviroment': 'environment',
  'pronounciation': 'pronunciation', 'calender': 'calendar'
};
const commonWords = ["accommodate", "definitely", "separate", "receive", "embarrass", "until", "government", "environment", "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing", "colleague", "successful", "tomorrow"];

let onXpUpdatedCallback = null, reloadVaultListCallback = null, loadPracticeDeckCallback = null;

export function initSandbox(onXpUpdated, reloadVaultList, loadPracticeDeck) {
  onXpUpdatedCallback = onXpUpdated;
  reloadVaultListCallback = reloadVaultList;
  loadPracticeDeckCallback = loadPracticeDeck;

  document.getElementById('quick-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleVerify();
  });

  const feedbackMsg = document.getElementById('feedback-msg');
  if (feedbackMsg) {
    feedbackMsg.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && e.target.id === 'manual-correction-input') {
        e.preventDefault();
        const correctVal = e.target.value.trim();
        const originalVal = document.getElementById('manual-correction-btn')?.getAttribute('data-original-word');
        const wrongVal = document.getElementById('manual-correction-btn')?.getAttribute('data-wrong-attempt') || '';
        if (correctVal && originalVal) await handleManualCorrection(correctVal, originalVal, wrongVal);
      }
    });

    feedbackMsg.addEventListener('click', async (e) => {
      const closeBtn = e.target.closest('.feedback-close-btn');
      if (closeBtn) { feedbackMsg.style.display = 'none'; return; }

      const playBtn = e.target.closest('[data-audio-url]');
      if (playBtn) {
        const url = playBtn.getAttribute('data-audio-url');
        if (url) new Audio(url).play().catch(err => console.error(err));
        return;
      }

      const acceptBtn = e.target.closest('.accept-suggestion-btn');
      if (acceptBtn) {
        await acceptSuggestion(acceptBtn.getAttribute('data-suggestion'), acceptBtn.getAttribute('data-original'));
        return;
      }

      const rejectBtn = e.target.closest('.reject-suggestion-btn');
      if (rejectBtn) {
        await showManualCorrectionForm(rejectBtn.getAttribute('data-original'));
        return;
      }

      const chip = e.target.closest('.alt-suggestion-chip');
      if (chip) {
        await renderMisspellingCard(feedbackMsg.getAttribute('data-original-query'), JSON.parse(feedbackMsg.getAttribute('data-suggestions-list')), parseInt(chip.getAttribute('data-index'), 10));
        return;
      }

      const manualChip = e.target.closest('.manual-suggest-chip');
      if (manualChip) {
        const input = document.getElementById('manual-correction-input');
        if (input) { input.value = manualChip.getAttribute('data-word'); input.focus(); }
        return;
      }

      const saveBtn = e.target.closest('#manual-correction-btn');
      if (saveBtn) {
        const correctVal = document.getElementById('manual-correction-input')?.value.trim();
        const originalVal = saveBtn.getAttribute('data-original-word');
        const wrongVal = saveBtn.getAttribute('data-wrong-attempt') || '';
        if (correctVal && originalVal) await handleManualCorrection(correctVal, originalVal, wrongVal);
      }
    });
  }
}

async function handleVerify() {
  const wordInput = document.getElementById('word-input');
  const feedbackMsg = document.getElementById('feedback-msg');
  const word = wordInput?.value.trim();
  if (!word) return;
  try {
    feedbackMsg.style.display = 'block';
    feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
    const lowerWord = word.toLowerCase();
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
    if (response.ok) {
      const data = await response.json();
      await handleCorrectSpelling(data[0], word);
    } else {
      const suggestions = await findSuggestions(lowerWord);
      if (suggestions.length > 0) {
        feedbackMsg.setAttribute('data-original-query', word);
        feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify(suggestions));
        await renderMisspellingCard(word, suggestions, 0);
      } else {
        await showManualCorrectionForm(word);
      }
    }
  } catch (err) { feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}

const closeBtnHtml = `
  <button type="button" class="feedback-close-btn" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

async function handleCorrectSpelling(apiData, word) {
  const def = apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  const ipa = apiData.phonetics.find(p => p.text)?.text || '/--/';
  const { us, uk } = extractAudios(apiData.phonetics);
  try {
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase());
    let subtext = '';
    if (existing) {
      if (existing.misspellings && existing.misspellings.length > 0) {
        existing.nextDate = Date.now() + 24 * 60 * 60 * 1000;
        await saveWords(words);
        subtext = `<p style="font-size: 0.68rem; color: var(--primary-light); margin: 4px 0 0;">You previously misspelled this word. Scheduled review tomorrow.</p>`;
      } else {
        subtext = `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 4px 0 0;">This word is already in your Word Vault.</p>`;
      }
    } else {
      await addWord({ word, definition: def, transcription: ipa, nextDate: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      await addXp(10); if (onXpUpdatedCallback) onXpUpdatedCallback();
      subtext = `<p style="font-size: 0.68rem; color: var(--success); margin: 4px 0 0;">Added to database.</p>`;
    }
    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correct Spelling!</h4>
      <p style="margin: 4px 0;"><strong>${word}</strong> ${ipa}</p>
      ${renderAudioButtons(us, uk)}
      <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;">${def}</p>
      ${subtext}
    `;
    document.getElementById('word-input').value = '';
    if (reloadVaultListCallback) await reloadVaultListCallback();
  } catch (err) { document.getElementById('feedback-msg').innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}

async function renderMisspellingCard(originalWord, suggestions, activeIndex) {
  const feedbackMsg = document.getElementById('feedback-msg');
  const suggestion = suggestions[activeIndex];
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Retrieving suggestions...</p>';
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
  let def = 'No definition found', ipa = '/--/', { us, uk } = { us: '', uk: '' };
  if (response.ok) {
    const data = await response.json();
    def = data[0].meanings[0]?.definitions[0]?.definition || def;
    ipa = data[0].phonetics.find(p => p.text)?.text || ipa;
    ({ us, uk } = extractAudios(data[0].phonetics));
  }
  let altChips = '';
  const alts = suggestions.filter((_, i) => i !== activeIndex);
  if (alts.length > 0) {
    altChips = `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 6px 0 2px;">Other suggestions: ` +
      alts.map(alt => `<button type="button" class="alt-suggestion-chip" data-index="${suggestions.indexOf(alt)}">${alt}</button>`).join('') + `</p>`;
  }
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--danger); margin: 0 0 4px;">❌ Misspelling Detected</h4>
    <p style="margin: 4px 0;">"${originalWord}" is incorrect. Did you mean <strong>${suggestion}</strong>?</p>
    ${renderAudioButtons(us, uk)}
    ${altChips}
    <div style="display: flex; gap: 6px; margin-top: 8px;">
      <button type="button" class="submit-btn accept-suggestion-btn" data-suggestion="${suggestion}" data-original="${originalWord}" style="width: auto; padding: 4px 8px; font-size: 0.72rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Accept</span>
      </button>
      <button type="button" class="submit-btn reject-suggestion-btn" data-original="${originalWord}" style="width: auto; padding: 4px 8px; font-size: 0.72rem; background: hsla(5, 80%, 15%, 0.3); border-color: var(--danger); color: var(--danger);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>Reject</span>
      </button>
    </div>
  `;
}

async function acceptSuggestion(suggestion, original) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving...</p>';
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
  let def = 'No definition found', ipa = '/--/';
  if (response.ok) {
    const data = await response.json();
    def = data[0].meanings[0]?.definitions[0]?.definition || def;
    ipa = data[0].phonetics.find(p => p.text)?.text || ipa;
  }
  await registerMisspelling(suggestion, original, { definition: def, transcription: ipa });
  await addXp(2); if (onXpUpdatedCallback) onXpUpdatedCallback();
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved</h4>
    <p style="font-size: 0.68rem; margin: 4px 0;">Added correct word <strong>"${suggestion}"</strong> to practice queue.</p>
    <p style="font-size: 0.65rem; color: var(--primary-light); margin: 4px 0 0;">Earned +2 XP (Effort points).</p>
  `;
  document.getElementById('word-input').value = '';
  if (reloadVaultListCallback) await reloadVaultListCallback();
  if (loadPracticeDeckCallback) await loadPracticeDeckCallback();
}

async function showManualCorrectionForm(originalWord, suggestions = [], wrongAttempt = '') {
  const f = document.getElementById('feedback-msg');
  const queryWord = wrongAttempt || originalWord;
  if (suggestions.length === 0) suggestions = await findSuggestions(queryWord);

  const title = wrongAttempt ? '❌ Word Not Found' : '❌ Spelling Error';
  const desc = wrongAttempt 
    ? `"${wrongAttempt}" is not recognized either. If you know the correct spelling, enter it below:`
    : `"${originalWord}" is not recognized. If you know the correct spelling, enter it below:`;
  
  const chipsHtml = suggestions.length > 0 
    ? `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 6px 0 2px;">Suggestions: ` +
      suggestions.map(s => `<button type="button" class="manual-suggest-chip" data-word="${s}">${s}</button>`).join('') + `</p>`
    : '';

  f.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--danger); margin: 0 0 4px;">${title}</h4>
    <p style="font-size: 0.72rem; margin: 0 0 8px;">${desc}</p>
    <div style="display: flex; gap: 6px;">
      <input type="text" id="manual-correction-input" class="premium-input" placeholder="Correct spelling..." value="${wrongAttempt}" style="width: 140px; padding: 4px 8px; font-size: 0.75rem;">
      <button type="button" id="manual-correction-btn" data-original-word="${originalWord}" data-wrong-attempt="${wrongAttempt}" class="submit-btn" style="width: 60px; padding: 4px; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Save</span>
      </button>
    </div>
    ${chipsHtml}
  `;
}

async function handleManualCorrection(correctWord, originalWord, wrongAttempt = '') {
  const feedbackMsg = document.getElementById('feedback-msg');
  try {
    feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(correctWord.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      const def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      const ipa = data[0].phonetics.find(p => p.text)?.text || '/--/';
      const { us, uk } = extractAudios(data[0].phonetics);
      
      await registerMisspelling(correctWord, originalWord, { definition: def, transcription: ipa });
      if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
        await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: ipa });
      }
      await addXp(10); if (onXpUpdatedCallback) onXpUpdatedCallback();
      feedbackMsg.innerHTML = `
        ${closeBtnHtml}
        <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
        <p style="margin: 4px 0;">Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).</p>
        ${renderAudioButtons(us, uk)}
      `;
      document.getElementById('word-input').value = '';
      if (reloadVaultListCallback) await reloadVaultListCallback();
      if (loadPracticeDeckCallback) await loadPracticeDeckCallback();
    } else {
      const suggestions = await findSuggestions(correctWord);
      await showManualCorrectionForm(originalWord, suggestions, correctWord);
    }
  } catch (err) { feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`; }
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

async function findSuggestions(word) {
  const lower = word.toLowerCase();
  if (spellingMap[lower]) return [spellingMap[lower]];
  const matches = [];
  try {
    const vaultWords = await getWords();
    for (const w of vaultWords) {
      const d = getLevenshtein(lower, w.word.toLowerCase());
      if (d < 3) matches.push({ word: w.word, dist: d });
    }
  } catch (e) { console.error(e); }
  try {
    const res = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(lower)}`);
    if (res.ok) {
      const data = await res.json();
      data.forEach(item => {
        const itemLower = item.word.toLowerCase();
        if (itemLower !== lower && !item.word.includes(' ')) {
          const d = getLevenshtein(lower, itemLower);
          if (d < 4) matches.push({ word: item.word, dist: d });
        }
      });
    }
  } catch (e) { console.error(e); }
  if (matches.length === 0) {
    commonWords.forEach(w => {
      const d = getLevenshtein(lower, w.toLowerCase());
      if (d < 3) matches.push({ word: w, dist: d });
    });
  }
  matches.sort((a, b) => a.dist - b.dist);
  return [...new Set(matches.map(m => m.word))].slice(0, 4);
}

function getLevenshtein(a, b) {
  const r = Array(b.length + 1).fill(0).map((_, i) => [i]);
  for (let j = 0; j <= a.length; j++) r[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) r[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? r[i - 1][j - 1] : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
  }
  return r[b.length][a.length];
}
