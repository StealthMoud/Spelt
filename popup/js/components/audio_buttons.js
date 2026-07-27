import { escapeHtml } from '../../shared/dom.js';

export function renderAudioButtons(word, margin = '8px 0 4px') {
  const safeWord = escapeHtml(word);
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${safeWord}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: ${margin};">${b('us', 'US')}${b('uk', 'UK')}</div>`;
}
