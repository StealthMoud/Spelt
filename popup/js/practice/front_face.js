import { censorWordInExample, getFallbackExample, fetchCambridgePronunciation, atomicUpdate } from '../../../shared/storage.js';
import { escapeHtml } from '../../../shared/dom.js';
import { getPracticeMode } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';

export function populateFrontFace(card, signal) {
  const mode = getPracticeMode();

  const frontSpellingContent = document.getElementById('front-spelling-content');
  const frontRecallContent = document.getElementById('front-recall-content');

  const frontSpellingWrapper = document.getElementById('front-spelling-wrapper');
  const frontRecallWrapper = document.getElementById('front-recall-wrapper');

  if (mode === 'recall') {
    if (frontSpellingContent) frontSpellingContent.classList.add('hidden');
    if (frontRecallContent) frontRecallContent.classList.remove('hidden');
    if (frontSpellingWrapper) frontSpellingWrapper.classList.add('hidden');
    if (frontRecallWrapper) frontRecallWrapper.classList.remove('hidden');

    document.getElementById('recall-front-word').textContent = card.word;
    document.getElementById('recall-front-transcription').textContent = card.transcription || '/--/';
    const recallAudio = document.getElementById('recall-front-audio-container');
    if (recallAudio) recallAudio.innerHTML = renderAudioButtons(card.word);
    document.getElementById('recall-front-pos').textContent = card.partOfSpeech || 'unknown';

    const levelContainer = document.getElementById('recall-front-level-container');
    const levelEl = document.getElementById('recall-front-level');
    if (levelContainer && levelEl) {
      const displayLevel = card.level || '';
      levelEl.textContent = displayLevel;
      levelContainer.classList.toggle('hidden', !displayLevel);
    }

    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    const exampleContainer = document.getElementById('recall-front-example-container');
    if (rawExample) {
      document.getElementById('recall-front-example').textContent = rawExample;
      if (exampleContainer) exampleContainer.classList.remove('hidden');
    } else {
      if (exampleContainer) exampleContainer.classList.add('hidden');
    }

    const hintEl = document.getElementById('recall-front-hint');
    if (hintEl) {
      hintEl.textContent = card.word.trim().includes(' ')
        ? 'What does this expression mean?'
        : 'What does this word mean?';
    }
  } else {
    if (frontSpellingContent) frontSpellingContent.classList.remove('hidden');
    if (frontRecallContent) frontRecallContent.classList.add('hidden');
    if (frontSpellingWrapper) frontSpellingWrapper.classList.remove('hidden');
    if (frontRecallWrapper) frontRecallWrapper.classList.add('hidden');

    document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
    document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
    document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

    const transEl = document.getElementById('practice-translation');
    if (transEl) {
      if (card.translation) {
        transEl.innerHTML = `<span class="translation-blur-text">${escapeHtml(card.translation)}</span><span class="translation-reveal-hint">Reveal</span>`;
        transEl.className = 'translation-clue-box';
        transEl.addEventListener('click', () => transEl.classList.add('revealed'), { signal });
      } else {
        transEl.textContent = '--'; transEl.className = '';
      }
    }

    const levelContainer = document.getElementById('practice-level-container');
    const levelEl = document.getElementById('practice-level');
    if (levelContainer && levelEl) {
      const displayLevel = card.level || '';
      const otherLevels = card.otherLevels || [];
      levelEl.innerHTML = displayLevel ? formatLevelDisplay(displayLevel, otherLevels) : '';
      levelContainer.classList.toggle('hidden', !displayLevel);
    }

    const exampleContainer = document.getElementById('practice-example-container');
    const exampleTransEl = document.getElementById('practice-example-translation');
    const translateBtn = document.getElementById('practice-translate-btn');
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (rawExample) {
      document.getElementById('practice-example').textContent = censorWordInExample(card.word, rawExample);
      exampleContainer.classList.remove('hidden');
    } else exampleContainer.classList.add('hidden');
    const isTransActive = translateBtn && translateBtn.classList.contains('active');
    if (isTransActive && card.exampleTranslation) {
      if (exampleTransEl) {
        exampleTransEl.textContent = `"${card.exampleTranslation}"`;
        exampleTransEl.classList.remove('hidden');
      }
    } else {
      if (exampleTransEl) { exampleTransEl.classList.add('hidden'); exampleTransEl.textContent = ''; }
      if (translateBtn) translateBtn.classList.remove('active');
    }

    const audioContainer = document.getElementById('practice-audio-container');
    if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  // Handle Cambridge pronunciation auto-fetch if level doesn't exist
  if (card.word && !card.level) {
    fetchCambridgePronunciation(card.word).then(async cambridge => {
      if (cambridge.level) {
        card.level = cambridge.level;
        card.otherLevels = (cambridge.allLevels || []).filter(l => l !== cambridge.level);

        if (mode === 'recall') {
          const lvlEl = document.getElementById('recall-front-level');
          const lvlContainer = document.getElementById('recall-front-level-container');
          if (lvlEl && lvlContainer) {
            lvlEl.textContent = card.level;
            lvlContainer.classList.remove('hidden');
          }
        } else {
          const lvlEl = document.getElementById('practice-level');
          const lvlContainer = document.getElementById('practice-level-container');
          if (lvlEl && lvlContainer) {
            lvlEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
            lvlContainer.classList.remove('hidden');
          }
        }

        await atomicUpdate(async (list) => {
          const w = list.find(x => x.id === card.id);
          if (w) { w.level = card.level; w.otherLevels = card.otherLevels; }
        });
      }
    }).catch(() => {});
  }
}
