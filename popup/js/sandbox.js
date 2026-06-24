import { getWords, addWord, registerMisspelling, saveWords, deleteWord, playWordAudio, playSentenceAudio, translateWord, getFallbackExample, fetchDynamicExample, fetchDynamicDefinition, fetchCambridgePronunciation, getStored, fetchTranslation, logSandboxActivity } from '../../shared/storage.js';

const spellingMap = {
  'definately': 'definitely', 'definitley': 'definitely', 'accomodate': 'accommodate', 'acomodate': 'accommodate',
  'seperate': 'separate', 'recieve': 'receive', 'goverment': 'government', 'enviroment': 'environment',
  'pronounciation': 'pronunciation', 'calender': 'calendar'
};
const commonWords = ["accommodate", "definitely", "separate", "receive", "embarrass", "until", "government", "environment", "occurred", "threshold", "pronunciation", "calendar", "necessary", "writing", "colleague", "successful", "tomorrow"];

let reloadVaultListCallback = null, loadPracticeDeckCallback = null;

export function initSandbox(reloadVaultList, loadPracticeDeck) {
  reloadVaultListCallback = reloadVaultList;
  loadPracticeDeckCallback = loadPracticeDeck;

  document.getElementById('quick-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleVerify();
  });

  document.getElementById('word-input')?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const inputVal = e.target.value.trim();
      if (inputVal) {
        e.preventDefault();
        await handleVerify();
      }
    }
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

      const playBtn = e.target.closest('.audio-play-btn');
      if (playBtn) {
        const word = playBtn.getAttribute('data-word');
        const accent = playBtn.getAttribute('data-accent');
        if (word && accent) {
          playWordAudio(word, accent).catch(err => console.error(err));
        }
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
        return;
      }

      const acceptAnywayBtn = e.target.closest('.accept-anyway-btn');
      if (acceptAnywayBtn) {
        const correct = feedbackMsg.getAttribute('data-correct-word');
        const original = feedbackMsg.getAttribute('data-original-word');
        const wrong = feedbackMsg.getAttribute('data-wrong-attempt');
        if (correct && original) {
          await saveManualAnyway(correct, original, wrong);
        }
        return;
      }

      const editCorrectionBtn = e.target.closest('.edit-correction-btn');
      if (editCorrectionBtn) {
        const original = feedbackMsg.getAttribute('data-original-word');
        const suggestions = JSON.parse(feedbackMsg.getAttribute('data-suggestions-list') || '[]');
        const wrong = feedbackMsg.getAttribute('data-wrong-attempt');
        if (original) {
          await showManualCorrectionForm(original, suggestions, wrong);
        }
        return;
      }

      const addToVaultBtn = e.target.closest('.add-to-vault-btn');
      if (addToVaultBtn) {
        await handleAddToVault(addToVaultBtn);
        return;
      }

      const playExBtn = e.target.closest('.play-example-btn');
      if (playExBtn) {
        const sentence = playExBtn.getAttribute('data-sentence');
        if (sentence) {
          playSentenceAudio(sentence, 'us');
        }
        return;
      }

      const translateBtn = e.target.closest('.translate-example-btn');
      if (translateBtn) {
        const container = translateBtn.closest('.feedback-example');
        if (container) {
          const textEl = container.querySelector('.feedback-example-text');
          const transEl = container.querySelector('.feedback-example-translation');
          if (textEl && transEl) {
            if (transEl.style.display === 'block') {
              transEl.style.display = 'none';
              translateBtn.classList.remove('active');
            } else {
              let trans = transEl.textContent.trim().replace(/^"|"$/g, '');
              if (!trans) {
                const targetLang = await getStored('spelt_target_lang');
                if (!targetLang || targetLang === 'none') {
                  alert('Please configure a preferred language in Settings first.');
                  return;
                }
                const rawExample = textEl.textContent.trim().replace(/^"|"$/g, '');
                transEl.textContent = 'Translating...';
                transEl.style.display = 'block';
                const fetchedTrans = await fetchTranslation(rawExample, targetLang);
                if (fetchedTrans) {
                  trans = fetchedTrans;
                  transEl.textContent = `"${trans}"`;
                  const wordAttr = container.getAttribute('data-word');
                  if (wordAttr) {
                    const allWords = await getWords();
                    const wObj = allWords.find(w => w.word.toLowerCase() === wordAttr.toLowerCase());
                    if (wObj) {
                      wObj.exampleTranslation = trans;
                      await saveWords(allWords);
                    }
                  }
                } else {
                  transEl.textContent = 'Translation failed';
                  return;
                }
              }
              transEl.style.display = 'block';
              translateBtn.classList.add('active');
            }
          }
        }
        return;
      }
    });
  }

  // Bind shortcuts: Enter to Accept / Play audio, Escape to Reject / Close
  window.addEventListener('keydown', async (e) => {
    const sandboxTab = document.getElementById('sandbox-tab');
    const isSandboxActive = sandboxTab && (sandboxTab.classList.contains('active') || window.getComputedStyle(sandboxTab).display !== 'none');
    if (!isSandboxActive) return;

    const active = document.activeElement;
    const isTyping = active && (
      active.tagName === 'TEXTAREA' ||
      (active.tagName === 'INPUT' && ['text', 'search', 'password', 'email', 'number', 'url'].includes(active.type))
    );

    const feedbackMsg = document.getElementById('feedback-msg');
    if (!feedbackMsg || feedbackMsg.style.display === 'none') return;

    if ((e.key === 't' || e.key === 'T') && !isTyping) {
      const translateBtn = feedbackMsg.querySelector('.translate-example-btn');
      if (translateBtn) {
        e.preventDefault();
        translateBtn.click();
      }
      return;
    }

    const acceptBtn = document.querySelector('.accept-suggestion-btn');
    const rejectBtn = document.querySelector('.reject-suggestion-btn');
    const acceptAnywayBtn = document.querySelector('.accept-anyway-btn');
    const editCorrectionBtn = document.querySelector('.edit-correction-btn');

    if (acceptAnywayBtn && editCorrectionBtn) {
      if (e.key === 'Enter') {
        if (isTyping) return;
        e.preventDefault();
        acceptAnywayBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editCorrectionBtn.click();
      }
      return;
    }

    if (acceptBtn && rejectBtn) {
      if (e.key === 'Enter') {
        if (isTyping) return;
        e.preventDefault();
        const suggestion = acceptBtn.getAttribute('data-suggestion');
        const original = acceptBtn.getAttribute('data-original');
        if (suggestion && original) {
          await acceptSuggestion(suggestion, original);
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const audioBtn = feedbackMsg.querySelector('.audio-play-btn');
        if (audioBtn) {
          const word = audioBtn.getAttribute('data-word');
          const accent = audioBtn.getAttribute('data-accent') || 'us';
          if (word) playWordAudio(word, accent).catch(err => console.error(err));
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const original = rejectBtn.getAttribute('data-original');
        if (original) {
          await showManualCorrectionForm(original);
        }
      }
    } else {
      if (e.key === 'Enter') {
        if (isTyping) return;
        e.preventDefault();
        const wordInput = document.getElementById('word-input');
        if (wordInput) { wordInput.focus(); }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const audioBtn = feedbackMsg.querySelector('.audio-play-btn');
        if (audioBtn) {
          const word = audioBtn.getAttribute('data-word');
          const accent = audioBtn.getAttribute('data-accent') || 'us';
          if (word) playWordAudio(word, accent).catch(err => console.error(err));
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        feedbackMsg.style.display = 'none';
        document.getElementById('word-input')?.focus();
      }
    }
  });
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
      logSandboxActivity('correct').catch(() => {});
      await handleCorrectSpelling(data[0], word);
    } else {
      // Fallback check: see if Cambridge/Oxford has this word
      let isWordValid = false;
      let cambridgeData = null;
      try {
        cambridgeData = await fetchCambridgePronunciation(lowerWord);
        if (cambridgeData.ukIpa || cambridgeData.usIpa || cambridgeData.level || cambridgeData.ukAudio) {
          isWordValid = true;
        }
      } catch (_) {}
      
      if (!isWordValid) {
        // Double check via dynamic definition
        try {
          const dynamicDef = await fetchDynamicDefinition(lowerWord);
          if (dynamicDef && dynamicDef !== 'No definition found') {
            isWordValid = true;
          }
        } catch (_) {}
      }
      
      if (isWordValid) {
        // Construct a mock apiData object and handle it as correct spelling
        const mockApiData = {
          word: lowerWord,
          phonetics: [],
          meanings: [
            {
              partOfSpeech: '',
              definitions: [
                {
                  definition: 'No definition found',
                  example: ''
                }
              ]
            }
          ]
        };
        logSandboxActivity('correct').catch(() => {});
        await handleCorrectSpelling(mockApiData, word);
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
  } catch (err) { feedbackMsg.innerHTML = `<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}

const closeBtnHtml = `
  <button type="button" class="feedback-close-btn" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

async function handleCorrectSpelling(apiData, word) {
  const def = await fetchDynamicDefinition(word) || apiData.meanings[0]?.definitions[0]?.definition || 'No definition found';
  let ipa = '';
  let level = '';
  try {
    const cambridge = await fetchCambridgePronunciation(word);
    if (cambridge.ukIpa && cambridge.usIpa) {
      ipa = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
    } else {
      ipa = cambridge.ukIpa || cambridge.usIpa || '';
    }
    level = cambridge.level || '';
  } catch (_) {}
  if (!ipa) {
    ipa = apiData.phonetics.find(p => p.text)?.text || '/--/';
  }
  const partOfSpeech = apiData.meanings[0]?.partOfSpeech || '';
  const example = extractExample(apiData) || await fetchDynamicExample(word) || getFallbackExample(word, partOfSpeech);
  
  let translation = '';
  try {
    translation = await translateWord(word);
  } catch (_) {}

  try {
    const words = await getWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase());
    if (existing && level && !existing.level) {
      existing.level = level;
      await saveWords(words);
    }
    const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
    const wordLevel = (existing && existing.level) ? existing.level : level;
    let subtext = '';
    
    if (existing) {
      // dont auto master it to keep the manual rule
      subtext = `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 8px 0 0; text-align: center;">Correct spelling! (Already in vault)</p>`;
    } else {
      subtext = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 8px;">
          <button type="button" class="submit-btn add-to-vault-btn" 
            data-word="${word.replace(/"/g, '&quot;')}" 
            data-definition="${def.replace(/"/g, '&quot;')}" 
            data-transcription="${ipa.replace(/"/g, '&quot;')}" 
            data-part-of-speech="${partOfSpeech.replace(/"/g, '&quot;')}" 
            data-example="${example.replace(/"/g, '&quot;')}" 
            data-translation="${translation.replace(/"/g, '&quot;')}"
            data-level="${wordLevel.replace(/"/g, '&quot;')}"
            style="width: auto; padding: 4px 10px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 11px; height: 11px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add to Vault</span>
          </button>
          <p style="font-size: 0.62rem; color: var(--text-muted); margin: 0;">Correct spelling! (Not saved to vault)</p>
        </div>
      `;
    }
    
    document.getElementById('feedback-msg').innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 6px;">✅ Correct Spelling!</h4>
      <p style="margin: 6px 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.02em;">${word} <span style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${ipa}</span></p>
      ${renderAudioButtons(word)}
      
      <div class="feedback-details">
        <div class="feedback-meta-row">
          ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
          ${wordLevel ? `<span class="feedback-badge level">${wordLevel}</span>` : ''}
          ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
        </div>
        <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;"><strong>Definition:</strong> ${def}</p>
        ${example ? `
          <div class="feedback-example" data-word="${word}">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span class="clue-label" style="margin: 0;">Example</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="play-example-btn" title="Pronounce Example" data-sentence="${example.replace(/"/g, '&quot;')}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
                <button type="button" class="translate-example-btn" title="Translate Example">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                </button>
              </div>
            </div>
            <p class="feedback-example-text">"${example}"</p>
            <p class="feedback-example-translation" style="display: none;">${exampleTranslation ? `"${exampleTranslation}"` : ''}</p>
          </div>
        ` : ''}
      </div>
      ${subtext}
    `;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultListCallback) await reloadVaultListCallback();
  } catch (err) { document.getElementById('feedback-msg').innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}

async function renderMisspellingCard(originalWord, suggestions, activeIndex) {
  const feedbackMsg = document.getElementById('feedback-msg');
  const suggestion = suggestions[activeIndex];
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Retrieving suggestions...</p>';
  let def = await fetchDynamicDefinition(suggestion), ipa = '', partOfSpeech = '', example = '', level = '';
  try {
    const cambridge = await fetchCambridgePronunciation(suggestion);
    if (cambridge.ukIpa && cambridge.usIpa) {
      ipa = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
    } else {
      ipa = cambridge.ukIpa || cambridge.usIpa || '';
    }
    level = cambridge.level || '';
  } catch (_) {}

  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${suggestion}`);
  if (response.ok) {
    const data = await response.json();
    if (!def) {
      def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
    }
    if (!ipa) {
      ipa = data[0].phonetics.find(p => p.text)?.text || '';
    }
    partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
    example = extractExample(data[0]);
  }
  if (!ipa) ipa = '/--/';
  if (!example) {
    example = await fetchDynamicExample(suggestion) || getFallbackExample(suggestion, partOfSpeech);
  }
  const words = await getWords();
  const existing = words.find(w => w.word.toLowerCase() === suggestion.toLowerCase());
  const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
  let translation = '';
  try {
    translation = await translateWord(suggestion);
  } catch (_) {}

  let altChips = '';
  const alts = suggestions.filter((_, i) => i !== activeIndex);
  if (alts.length > 0) {
    altChips = `<p style="font-size: 0.68rem; color: var(--text-muted); margin: 6px 0 2px;">Other suggestions: ` +
      alts.map(alt => `<button type="button" class="alt-suggestion-chip" data-index="${suggestions.indexOf(alt)}">${alt}</button>`).join('') + `</p>`;
  }
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--danger); margin: 0 0 6px;">❌ Misspelling Detected</h4>
    <p style="margin: 6px 0; font-size: 0.74rem;">"${originalWord}" is incorrect. Did you mean:</p>
    <p style="margin: 4px 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.02em; color: var(--primary-light);">${suggestion}${ipa !== '/--/' ? ` <span style="font-size: 0.78rem; font-weight: 400; color: var(--text-muted); margin-left: 4px;">${ipa}</span>` : ''}</p>
    ${renderAudioButtons(suggestion)}
    
    <div class="feedback-details">
      <div class="feedback-meta-row">
        ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
        ${level ? `<span class="feedback-badge level">${level}</span>` : ''}
        ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
      </div>
      <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;"><strong>Definition:</strong> ${def}</p>
      ${example ? `
        <div class="feedback-example" data-word="${suggestion}">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span class="clue-label" style="margin: 0;">Example</span>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="play-example-btn" title="Pronounce Example" data-sentence="${example.replace(/"/g, '&quot;')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
              <button type="button" class="translate-example-btn" title="Translate Example">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              </button>
            </div>
          </div>
          <p class="feedback-example-text">"${example}"</p>
          <p class="feedback-example-translation" style="display: none;">${exampleTranslation ? `"${exampleTranslation}"` : ''}</p>
        </div>
      ` : ''}
    </div>
    
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
  
  const words = await getWords();
  const exists = words.some(w => w.word.toLowerCase() === suggestion.toLowerCase());

  let def = await fetchDynamicDefinition(suggestion), ipa = '', partOfSpeech = '', example = '', level = '';
  try {
    const cambridge = await fetchCambridgePronunciation(suggestion);
    if (cambridge.ukIpa && cambridge.usIpa) {
      ipa = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
    } else {
      ipa = cambridge.ukIpa || cambridge.usIpa || '';
    }
    level = cambridge.level || '';
  } catch (_) {}

  let isInvalidWord = false;
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(suggestion.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      if (!def || def === 'No definition found') {
        def = data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      }
      if (!ipa) {
        ipa = data[0].phonetics.find(p => p.text)?.text || '';
      }
      partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
      example = extractExample(data[0]);
    } else if (response.status === 404) {
      if (!def || def === 'No definition found') {
        isInvalidWord = true;
      }
    }
  } catch (err) {
    console.warn('Verify suggestion failed:', err);
  }

  if (isInvalidWord) {
    feedbackMsg.setAttribute('data-correct-word', suggestion);
    feedbackMsg.setAttribute('data-original-word', original);
    feedbackMsg.setAttribute('data-wrong-attempt', '');
    feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify([]));
    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--warning); margin: 0 0 4px;">⚠️ Unrecognized Suggestion</h4>
      <p style="font-size: 0.72rem; margin: 8px 0; line-height: 1.4;">"${suggestion}" is not recognized in the dictionary. It might be misspelled.</p>
      <div style="display: flex; gap: 6px; margin-top: 8px;">
        <button type="button" class="submit-btn accept-anyway-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Save Anyway</span>
        </button>
        <button type="button" class="submit-btn edit-correction-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem; background: hsla(5, 80%, 15%, 0.3); border-color: var(--danger); color: var(--danger);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span>Edit Spelling</span>
        </button>
      </div>
    `;
    return;
  }

  if (!ipa) ipa = '/--/';
  await registerMisspelling(suggestion, original, { definition: def, transcription: ipa, partOfSpeech, example, level });
  const exampleText = example ? `<p style="font-size: 0.65rem; color: var(--primary-light); font-style: italic; margin: 4px 0 0;">"${example}"</p>` : '';
  feedbackMsg.innerHTML = `
    ${closeBtnHtml}
    <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved</h4>
    <p style="font-size: 0.68rem; margin: 4px 0;">${exists ? `Updated existing word <strong>"${suggestion}"</strong> in practice queue.` : `Added correct word <strong>"${suggestion}"</strong> to practice queue.`}</p>
    ${exampleText}
  `;
  document.getElementById('word-input').value = '';
  document.getElementById('word-input')?.blur();
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
  document.getElementById('manual-correction-input')?.focus();
}

async function handleManualCorrection(correctWord, originalWord, wrongAttempt = '') {
  const feedbackMsg = document.getElementById('feedback-msg');
  try {
    feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Verifying spelling...</p>';
    
    const words = await getWords();
    const exists = words.some(w => w.word.toLowerCase() === correctWord.toLowerCase());

    let ipa = '';
    let level = '';
    try {
      const cambridge = await fetchCambridgePronunciation(correctWord);
      if (cambridge.ukIpa && cambridge.usIpa) {
        ipa = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
      } else {
        ipa = cambridge.ukIpa || cambridge.usIpa || '';
      }
      level = cambridge.level || '';
    } catch (_) {}

    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(correctWord.toLowerCase())}`);
    if (response.ok) {
      const data = await response.json();
      const def = await fetchDynamicDefinition(correctWord) || data[0].meanings[0]?.definitions[0]?.definition || 'No definition found';
      if (!ipa) {
        ipa = data[0].phonetics.find(p => p.text)?.text || '';
      }
      if (!ipa) ipa = '/--/';
      const partOfSpeech = data[0].meanings[0]?.partOfSpeech || '';
      const example = extractExample(data[0]) || await fetchDynamicExample(correctWord) || getFallbackExample(correctWord, partOfSpeech);
      const existing = words.find(w => w.word.toLowerCase() === correctWord.toLowerCase());
      const exampleTranslation = existing ? (existing.exampleTranslation || '') : '';
      
      let translation = '';
      try {
        translation = await translateWord(correctWord);
      } catch (_) {}

      await registerMisspelling(correctWord, originalWord, { definition: def, transcription: ipa, partOfSpeech, example, exampleTranslation, level });
      if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
        await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: ipa, partOfSpeech, example, exampleTranslation, level });
      }
      
      feedbackMsg.innerHTML = `
        ${closeBtnHtml}
        <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
        <p style="margin: 4px 0; font-size: 0.72rem;">${exists ? `Updated existing word <strong>${correctWord}</strong> (${originalWord} saved as misspelling).` : `Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).`}</p>
        
        <div class="feedback-details">
          <div class="feedback-meta-row">
            ${partOfSpeech ? `<span class="feedback-badge pos">${partOfSpeech}</span>` : ''}
            ${level ? `<span class="feedback-badge level">${level}</span>` : ''}
            ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
          </div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;"><strong>Definition:</strong> ${def}</p>
          ${example ? `
            <div class="feedback-example" data-word="${correctWord}">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="clue-label" style="margin: 0;">Example</span>
                <div style="display: flex; gap: 4px;">
                  <button type="button" class="play-example-btn" title="Pronounce Example" data-sentence="${example.replace(/"/g, '&quot;')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                  <button type="button" class="translate-example-btn" title="Translate Example">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                  </button>
                </div>
              </div>
              <p class="feedback-example-text">"${example}"</p>
              <p class="feedback-example-translation" style="display: none;">${exampleTranslation ? `"${exampleTranslation}"` : ''}</p>
            </div>
          ` : ''}
        </div>
        ${renderAudioButtons(correctWord)}
      `;
      document.getElementById('word-input').value = '';
      document.getElementById('word-input')?.blur();
      if (reloadVaultListCallback) await reloadVaultListCallback();
      if (loadPracticeDeckCallback) await loadPracticeDeckCallback();
    } else {
      feedbackMsg.setAttribute('data-correct-word', correctWord);
      feedbackMsg.setAttribute('data-original-word', originalWord);
      feedbackMsg.setAttribute('data-wrong-attempt', wrongAttempt);
      const suggestions = await findSuggestions(correctWord);
      feedbackMsg.setAttribute('data-suggestions-list', JSON.stringify(suggestions));
      feedbackMsg.innerHTML = `
        ${closeBtnHtml}
        <h4 style="color: var(--warning); margin: 0 0 4px;">⚠️ Unrecognized Word</h4>
        <p style="font-size: 0.72rem; margin: 8px 0; line-height: 1.4;">"${correctWord}" is not recognized in the dictionary. It might be misspelled.</p>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button type="button" class="submit-btn accept-anyway-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Save Anyway</span>
          </button>
          <button type="button" class="submit-btn edit-correction-btn" style="width: auto; padding: 4px 8px; font-size: 0.72rem; background: hsla(5, 80%, 15%, 0.3); border-color: var(--danger); color: var(--danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Edit Spelling</span>
          </button>
        </div>
      `;
    }
  } catch (err) { feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`; }
}

async function saveManualAnyway(correctWord, originalWord, wrongAttempt = '') {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving...</p>';
  try {
    const words = await getWords();
    const exists = words.some(w => w.word.toLowerCase() === correctWord.toLowerCase());

    const def = 'Custom word entry';
    const partOfSpeech = '';
    const example = getFallbackExample(correctWord, partOfSpeech);
    
    let translation = '';
    try {
      translation = await translateWord(correctWord);
    } catch (_) {}

    await registerMisspelling(correctWord, originalWord, { definition: def, transcription: '/--/', partOfSpeech, example });
    if (wrongAttempt && wrongAttempt.toLowerCase() !== originalWord.toLowerCase() && wrongAttempt.toLowerCase() !== correctWord.toLowerCase()) {
      await registerMisspelling(correctWord, wrongAttempt, { definition: def, transcription: '/--/', partOfSpeech, example });
    }

    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 4px;">✅ Correction Saved!</h4>
      <p style="margin: 4px 0; font-size: 0.72rem;">${exists ? `Updated existing word <strong>${correctWord}</strong> (${originalWord} saved as misspelling).` : `Added <strong>${correctWord}</strong> (${originalWord} saved as misspelling).`}</p>
      
      <div class="feedback-details">
        <div class="feedback-meta-row">
          ${translation ? `<span class="feedback-badge trans">${translation}</span>` : ''}
        </div>
        <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0;"><strong>Definition:</strong> ${def}</p>
      </div>
      ${renderAudioButtons(correctWord)}
    `;
    document.getElementById('word-input').value = '';
    document.getElementById('word-input')?.blur();
    if (reloadVaultListCallback) await reloadVaultListCallback();
    if (loadPracticeDeckCallback) await loadPracticeDeckCallback();
  } catch (err) {
    feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`;
  }
}

function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 8px 0 4px;">${b('us', 'US')}${b('uk', 'UK')}</div>`;
}

function isValidSuggestion(query, candidate, d) {
  const qLower = query.toLowerCase();
  const cLower = candidate.toLowerCase();
  if (qLower[0] !== cLower[0]) {
    // If first letters differ and either word is short, reject larger distances
    if (qLower.length <= 5 || cLower.length <= 5) {
      return d < 2;
    }
  }
  return true;
}

async function findSuggestions(word) {
  const lower = word.toLowerCase();
  if (spellingMap[lower]) return [spellingMap[lower]];
  const matches = [];
  try {
    const vaultWords = await getWords();
    for (const w of vaultWords) {
      const d = getLevenshtein(lower, w.word.toLowerCase());
      if (d < 3 && isValidSuggestion(lower, w.word, d)) {
        matches.push({ word: w.word, dist: d });
      }
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
          if (d < 4 && isValidSuggestion(lower, item.word, d)) {
            matches.push({ word: item.word, dist: d });
          }
        }
      });
    }
  } catch (e) { console.error(e); }
  if (matches.length === 0) {
    commonWords.forEach(w => {
      const d = getLevenshtein(lower, w.toLowerCase());
      if (d < 3 && isValidSuggestion(lower, w, d)) {
        matches.push({ word: w, dist: d });
      }
    });
  }
  matches.sort((a, b) => a.dist - b.dist);
  return [...new Set(matches.map(m => m.word).filter(w => w.toLowerCase() !== lower))].slice(0, 4);
}

function getLevenshtein(a, b) {
  const r = Array(b.length + 1).fill(0).map((_, i) => [i]);
  for (let j = 0; j <= a.length; j++) r[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) r[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? r[i - 1][j - 1] : Math.min(r[i - 1][j - 1] + 1, r[i][j - 1] + 1, r[i - 1][j] + 1);
  }
  return r[b.length][a.length];
}

function extractExample(apiData) {
  if (!apiData || !apiData.meanings) return '';
  for (const m of apiData.meanings) {
    if (m.definitions) {
      for (const d of m.definitions) {
        if (d.example) return d.example.trim();
      }
    }
  }
  return '';
}

async function handleAddToVault(btn) {
  const feedbackMsg = document.getElementById('feedback-msg');
  feedbackMsg.innerHTML = '<p style="color: var(--primary-light);">Saving to vault...</p>';
  try {
    const word = btn.getAttribute('data-word');
    const definition = btn.getAttribute('data-definition') || 'No definition found';
    const transcription = btn.getAttribute('data-transcription') || '';
    const partOfSpeech = btn.getAttribute('data-part-of-speech') || '';
    const example = btn.getAttribute('data-example') || '';
    const translation = btn.getAttribute('data-translation') || '';
    const level = btn.getAttribute('data-level') || '';

    await addWord({
      word,
      definition,
      transcription,
      partOfSpeech,
      example,
      translation,
      level
    });

    feedbackMsg.innerHTML = `
      ${closeBtnHtml}
      <h4 style="color: var(--success); margin: 0 0 4px;">✅ Added to Vault</h4>
      <p style="font-size: 0.68rem; margin: 4px 0;">Word <strong>"${word}"</strong> has been successfully added to your practice vault.</p>
    `;
    
    if (reloadVaultListCallback) await reloadVaultListCallback();
    if (loadPracticeDeckCallback) await loadPracticeDeckCallback();
  } catch (err) {
    feedbackMsg.innerHTML = `${closeBtnHtml}<p style="color: var(--danger);">Error: ${err.message}</p>`;
  }
}
