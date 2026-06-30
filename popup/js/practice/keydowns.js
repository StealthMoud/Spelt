import { getFallbackExample, playTextAudio, playWordAudio } from '../../../shared/storage.js';
import { getDueCards } from './state.js';
import { submitRating } from './rate.js';

export function registerKeydowns() {
  document.getElementById('practice-play-example-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    const rawExample = card?.example || getFallbackExample(card?.word || '', card?.partOfSpeech || '');
    if (rawExample) playTextAudio(rawExample, 'uk');
  });

  document.getElementById('back-play-example-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    const rawExample = card?.example || getFallbackExample(card?.word || '', card?.partOfSpeech || '');
    if (rawExample) playTextAudio(rawExample, 'uk');
  });

  document.getElementById('practice-play-definition-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    if (card?.definition) playTextAudio(card.definition, 'uk');
  });

  document.getElementById('back-play-definition-btn')?.addEventListener('click', () => {
    const card = getDueCards()[0];
    if (card?.definition) playTextAudio(card.definition, 'uk');
  });

  window.addEventListener('keydown', async (e) => {
    const practiceTab = document.getElementById('practice-tab');
    if (!practiceTab || !practiceTab.classList.contains('active')) return;
    if (document.getElementById('word-form-modal')?.style.display === 'flex') return;

    const cardEl = document.getElementById('popup-deck-card');
    if (!cardEl) return;

    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'search'].includes(active.type)));

    if ((e.key === 't' || e.key === 'T') && !isTyping) {
      e.preventDefault(); e.stopPropagation();
      const btnId = cardEl.classList.contains('flipped') ? 'back-translate-btn' : 'practice-translate-btn';
      document.getElementById(btnId)?.click();
      return;
    }

    if (!cardEl.classList.contains('flipped')) {
      const spellInput = document.getElementById('spelling-input');
      if (e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        document.querySelector('#practice-audio-container .audio-play-btn')?.click();
      } else if (e.key === 'Enter' && document.activeElement !== spellInput) {
        e.preventDefault(); e.stopPropagation(); spellInput?.focus();
      }
      return;
    }

    if (e.key === '1') { e.preventDefault(); e.stopPropagation(); await submitRating(1); }
    else if (e.key === '2') { e.preventDefault(); e.stopPropagation(); await submitRating(3); }
    else if (e.key === '3') { e.preventDefault(); e.stopPropagation(); await submitRating(4); }
    else if (e.key === '4') { e.preventDefault(); e.stopPropagation(); await submitRating(5); }
    else if (e.key === '5') { e.preventDefault(); e.stopPropagation(); document.querySelector('#practice-tab .srs-mastered')?.click(); }
    else if (e.key === ' ') {
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
