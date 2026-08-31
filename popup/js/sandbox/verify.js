import { fetchCambridgePronunciation, fetchDynamicDefinition, logSandboxActivity } from '../../../shared/storage.js';
import { findSuggestions } from './spelling.js';
import { handleCorrectSpelling } from './correct_card.js';
import { renderMisspellingCard } from './misspell_card.js';
import { showManualCorrectionForm } from './manual_form.js';
import { escapeHtml } from '../../../shared/dom.js';

const historyList = [];

export function pushSandboxHistory(word) {
  if (!word) return;
  const clean = word.trim();
  const idx = historyList.indexOf(clean);
  if (idx !== -1) historyList.splice(idx, 1);
  historyList.unshift(clean);
  if (historyList.length > 10) historyList.pop();

  const container = document.getElementById('sandbox-history-container');
  if (container) {
    if (historyList.length > 0) {
      container.classList.remove('hidden');
      container.innerHTML = historyList.map(w =>
        `<button type="button" class="sandbox-history-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`
      ).join('');
    } else {
      container.classList.add('hidden');
    }
  }
}

function renderLoadingSkeleton(stepText) {
  const feedbackMsg = document.getElementById('feedback-msg');
  if (!feedbackMsg) return;
  feedbackMsg.classList.remove('hidden');
  feedbackMsg.innerHTML = `
    <div class="sandbox-result-card">
      <p class="text-primary-light sandbox-loading-status">${escapeHtml(stepText)}</p>
      <div class="sandbox-skeleton-line sandbox-skeleton-medium"></div>
      <div class="sandbox-skeleton-line sandbox-skeleton-long"></div>
      <div class="sandbox-skeleton-line sandbox-skeleton-short"></div>
    </div>
  `;
}

export async function handleVerify(reloadVaultListCallback) {
  const wordInput = document.getElementById('word-input');
  const feedbackMsg = document.getElementById('feedback-msg');
  const word = wordInput?.value.trim();
  if (!word) return;
  
  pushSandboxHistory(word);

  try {
    renderLoadingSkeleton('Checking primary dictionary…');
    const lowerWord = word.toLowerCase();
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
    if (response.ok) {
      const data = await response.json();
      logSandboxActivity('correct').catch(() => {});
      await handleCorrectSpelling(data[0], word, reloadVaultListCallback);
    } else {
      renderLoadingSkeleton('Checking secondary sources & pronunciations…');
      let isWordValid = false;
      let cambridgeData = null;
      try {
        cambridgeData = await fetchCambridgePronunciation(lowerWord);
        if (cambridgeData.ukIpa || cambridgeData.usIpa || cambridgeData.level || cambridgeData.ukAudio) {
          isWordValid = true;
        }
      } catch {}
      
      if (!isWordValid) {
        try {
          const defResult = await fetchDynamicDefinition(lowerWord);
          if (defResult.definition && defResult.definition !== 'No definition found') isWordValid = true;
        } catch {}
      }
      
      if (isWordValid) {
        const mockApiData = {
          word: lowerWord,
          phonetics: [],
          meanings: [{ partOfSpeech: '', definitions: [{ definition: 'No definition found', example: '' }] }]
        };
        logSandboxActivity('correct').catch(() => {});
        await handleCorrectSpelling(mockApiData, word, reloadVaultListCallback);
      } else {
        renderLoadingSkeleton('Finding spelling suggestions…');
        const suggestions = await findSuggestions(lowerWord);
        if (suggestions.length > 0) {
          logSandboxActivity('misspelled').catch(() => {});
          feedbackMsg.setAttribute('data-original-query', word);
          feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify(suggestions));
          await renderMisspellingCard(word, suggestions, 0);
          document.getElementById('word-input')?.blur();
        } else {
          logSandboxActivity('not_found').catch(() => {});
          await showManualCorrectionForm(word);
        }
      }
    }
  } catch (err) { feedbackMsg.innerHTML = `<p class="text-danger">Error: ${escapeHtml(err.message)}</p>`; }
}
