let statsTooltipEl = null;

export function showStatsTooltip(x, y, text) {
  if (!statsTooltipEl) {
    statsTooltipEl = document.createElement('div');
    statsTooltipEl.className = 'stats-tooltip';
    document.body.appendChild(statsTooltipEl);
  }
  statsTooltipEl.innerHTML = text;
  statsTooltipEl.style.left = `${x}px`;
  statsTooltipEl.style.top = `${y}px`;
  statsTooltipEl.classList.add('visible');
}

export function hideStatsTooltip() {
  if (statsTooltipEl) {
    statsTooltipEl.classList.remove('visible');
  }
}
