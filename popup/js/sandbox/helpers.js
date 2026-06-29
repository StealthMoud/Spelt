export const closeBtnHtml = `
  <button type="button" class="feedback-close-btn" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
`;

export function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 8px 0 4px;">${b('uk', 'UK')}${b('us', 'US')}</div>`;
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
