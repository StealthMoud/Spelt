import { fetchCambridgePronunciation, fetchDynamicDefinition, logSandboxActivity } from '../../../shared/storage.js';
import { findSuggestions } from './spelling.js';
import { handleCorrectSpelling } from './correct_card.js';
import { renderMisspellingCard } from './misspell_card.js';
import { showManualCorrectionForm } from './manual_form.js';
import { escapeHtml } from '../../../shared/dom.js';

export async function handleVerify(reloadVaultListCallback) {
  const wordInput = document.getElementById('word-input');
  const feedbackMsg = document.getElementById('feedback-msg');
  const word = wordInput?.value.trim();
  if (!word) return;
  try {
    feedbackMsg.classList.remove('hidden');
    feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
    const lowerWord = word.toLowerCase();
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`);
    if (response.ok) {
      const data = await response.json();
      logSandboxActivity('correct').catch(() => {});
      await handleCorrectSpelling(data[0], word, reloadVaultListCallback);
    } else {
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
  } catch (err) { feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${escapeHtml(err.message)}</p>`; }
}
