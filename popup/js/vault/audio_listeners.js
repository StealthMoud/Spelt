import { playWordAudio } from '../../../shared/storage.js';
import { closeModal } from './modal.js';

export function registerAudioListeners() {
  const playUK = (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (word) playWordAudio(word, 'uk').catch(err => console.error(err));
  };
  const playUS = (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (word) playWordAudio(word, 'us').catch(err => console.error(err));
  };

  document.getElementById('form-play-uk')?.addEventListener('click', playUK);
  document.getElementById('form-play-us')?.addEventListener('click', playUS);

  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('word-form-modal');
    if (!modal || modal.style.display === 'none') return;
    if (e.key === ' ' || e.key === 'Escape') {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'search'].includes(active.type)));
      if (isTyping) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === ' ') {
        const word = document.getElementById('form-word')?.value.trim();
        if (word) playWordAudio(word, 'uk').catch(err => console.error(err));
      } else if (e.key === 'Escape') {
        closeModal();
      }
    }
  });
}
