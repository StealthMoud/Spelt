import { renderAudioButtons as renderAudioBtn } from '../components/audio_buttons.js';

export function renderAudioButtons(word) {
  return renderAudioBtn(word, '4px 0 4px');
}

export function formatLevelDisplay(level, otherLevels = []) {
  const filtered = otherLevels.filter(l => l && l !== level);
  const badge = filtered.length > 0
    ? ` <span style="font-size: 0.55rem; color: var(--text-muted); font-weight: 400;">(Also: ${filtered.join(', ')})</span>`
    : '';
  return level + badge;
}
