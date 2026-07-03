import { getFallbackExample, playTextAudio, playWordAudio } from '../../../shared/storage.js';
import { getDueCards, getPracticeMode } from './state.js';
import { submitRating } from './rate.js';
import { revealRecall } from './actions.js';

export function registerKeydowns() {
  document.getElementById('practice-play-example-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    const rawExample = card?.example || getFallbackExample(card?.word || '', card?.partOfSpeech || '');
    if (rawExample) playTextAudio(rawExample, 'us');
  });

  document.getElementById('back-play-example-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    const rawExample = card?.example || getFallbackExample(card?.word || '', card?.partOfSpeech || '');
    if (rawExample) playTextAudio(rawExample, 'us');
  });

  document.getElementById('practice-play-definition-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    if (card?.definition) playTextAudio(card.definition, 'us');
  });

  document.getElementById('back-play-definition-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    if (card?.definition) playTextAudio(card.definition, 'us');
  });

  window.addEventListener('keydown', async (e) => {
    const practiceTab = document.getElementById('practice-tab');
    if (!practiceTab || !practiceTab.classList.contains('active')) return;
    if (document.getElementById('word-form-modal')?.style.display === 'flex') return;

    const cardEl = document.getElementById('popup-deck-card');
    if (!cardEl || getDueCards().length === 0) return;

    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'search'].includes(active.type)));

    if ((e.key === 't' || e.key === 'T') && !isTyping) {
      e.preventDefault(); e.stopPropagation();
      const btnId = cardEl.classList.contains('flipped') ? 'back-translate-btn' : 'practice-translate-btn';
      document.getElementById(btnId)?.click();
      return;
    }

    const mode = getPracticeMode();

    if (!cardEl.classList.contains('flipped')) {
      if (e.key === ' ' || e.key === 'Enter') {
        if (mode === 'recall') {
          e.preventDefault(); e.stopPropagation();
          revealRecall();
        } else if (mode === 'syntax') {
          const syntaxInput = document.getElementById('syntax-joints-input');
          if (e.key === 'Enter' && document.activeElement !== syntaxInput) {
            e.preventDefault(); e.stopPropagation(); syntaxInput?.focus();
          }
        } else {
          const spellInput = document.getElementById('spelling-input');
          if (e.key === ' ') {
            if (document.activeElement === spellInput) return; // Allow space in text box
            e.preventDefault(); e.stopPropagation();
            document.querySelector('#practice-audio-container .audio-play-btn')?.click();
          } else if (e.key === 'Enter' && document.activeElement !== spellInput) {
            e.preventDefault(); e.stopPropagation(); spellInput?.focus();
          }
        }
      } else if ((e.key === 'r' || e.key === 'R' || e.key === 'p' || e.key === 'P') && !isTyping) {
        if (mode === 'syntax') return;
        e.preventDefault(); e.stopPropagation();
        const query = mode === 'recall' ? '#recall-front-audio-container .audio-play-btn' : '#practice-audio-container .audio-play-btn';
        document.querySelector(query)?.click();
      }
      return;
    }

    if (e.key === '1') { e.preventDefault(); e.stopPropagation(); await submitRating(1); }
    else if (e.key === '2') { e.preventDefault(); e.stopPropagation(); await submitRating(3); }
    else if (e.key === '3') { e.preventDefault(); e.stopPropagation(); await submitRating(4); }
    else if (e.key === '4') { e.preventDefault(); e.stopPropagation(); await submitRating(5); }
    else if (e.key === '5') { e.preventDefault(); e.stopPropagation(); document.querySelector('#practice-tab .srs-mastered')?.click(); }
    else if ((e.key === ' ' || e.key === 'r' || e.key === 'R' || e.key === 'p' || e.key === 'P') && !isTyping) {
      if (mode === 'syntax') return;
      e.preventDefault(); e.stopPropagation();
      (document.querySelector('#back-audio-container .audio-play-btn') || document.querySelector('#popup-deck-card .audio-play-btn'))?.click();
    } else {
      const modal = document.getElementById('popup-confirm-modal');
      if (modal && modal.style.display === 'flex') {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); document.getElementById('popup-confirm-ok-btn')?.click(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); document.getElementById('popup-confirm-cancel-btn')?.click(); }
      }
    }
  }, true);

  document.getElementById('popup-deck-card')?.addEventListener('click', (e) => {
    const playBtn = e.target.closest('.audio-play-btn');
    if (playBtn) {
      const word = playBtn.getAttribute('data-word');
      const accent = playBtn.getAttribute('data-accent');
      if (word && accent) playWordAudio(word, accent).catch(err => console.error(err));
    }
  });
}
