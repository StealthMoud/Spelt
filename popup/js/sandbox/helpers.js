import { renderAudioButtons as renderAudioBtn } from '../components/audio_buttons.js';

export const closeBtnHtml = `
  <button type="button" class="feedback-close-btn" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

export function renderAudioButtons(word) {
  return renderAudioBtn(word, '8px 0 4px');
}

export function extractExample(apiData) {
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
