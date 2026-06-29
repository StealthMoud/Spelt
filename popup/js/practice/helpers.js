export function renderAudioButtons(word) {
  const b = (accent, label) => `<button type="button" class="audio-play-btn" data-word="${word}" data-accent="${accent}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px; vertical-align: middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> <span>${label}</span></button>`;
  return `<div style="display: flex; gap: 6px; margin: 4px 0 4px;">${b('uk', 'UK')}${b('us', 'US')}</div>`;
}

export function formatLevelDisplay(level, otherLevels = []) {
  const filtered = otherLevels.filter(l => l && l !== level);
  const badge = filtered.length > 0
    ? ` <span style="font-size: 0.55rem; color: var(--text-muted); font-weight: 400;">(Also: ${filtered.join(', ')})</span>`
    : '';
  return level + badge;
}
