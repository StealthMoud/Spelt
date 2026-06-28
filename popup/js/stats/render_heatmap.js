import { getLocalDateString } from '../../../shared/storage.js';
import { showStatsTooltip, hideStatsTooltip } from './tooltip.js';

const formatStudyTime = (ms) => {
  if (!ms || isNaN(ms)) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

export function renderHeatmap(reviewActivity, studyTimeActivity = {}) {
  const heatmapContainer = document.getElementById('stats-heatmap-container');
  const monthsContainer = document.getElementById('stats-heatmap-months');
  const heatmapYearEl = document.getElementById('stats-heatmap-year');
  if (!heatmapContainer) return;

  heatmapContainer.innerHTML = '';
  if (monthsContainer) monthsContainer.innerHTML = '';

  const tempDate = new Date();
  const endYear = tempDate.getFullYear();
  const dayOfWeek = tempDate.getDay();
  const offsetDays = 364 + (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  tempDate.setDate(tempDate.getDate() - offsetDays);
  const startYear = tempDate.getFullYear();

  if (heatmapYearEl) {
    heatmapYearEl.textContent = startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;
  }

  let currentMonthName = '';
  const totalDays = 371;

  for (let i = 0; i < totalDays; i++) {
    const dateStr = getLocalDateString(tempDate);
    const count = reviewActivity[dateStr] || 0;
    const timeMs = studyTimeActivity[dateStr] || 0;

    let level = 0;
    if (count > 0 && count <= 3) level = 1;
    else if (count > 3 && count <= 8) level = 2;
    else if (count > 8 && count <= 15) level = 3;
    else if (count > 15) level = 4;

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.setAttribute('data-level', level.toString());

    const formattedDate = tempDate.toLocaleDateString(undefined, { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
    const timeText = timeMs > 0 ? `<br/>⏱️ Study Time: ${formatStudyTime(timeMs)}` : '';
    const tooltipText = `<strong>${formattedDate}</strong><br/>${count} review${count === 1 ? '' : 's'}${timeText}`;

    cell.addEventListener('mouseenter', (e) => showStatsTooltip(e.clientX, e.clientY, tooltipText));
    cell.addEventListener('mouseleave', hideStatsTooltip);

    heatmapContainer.appendChild(cell);

    if (i % 7 === 0 && monthsContainer) {
      const monthName = tempDate.toLocaleDateString(undefined, { month: 'short' });
      if (monthName !== currentMonthName) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'heatmap-month-label';
        monthLabel.textContent = monthName;
        monthLabel.style.gridColumnStart = Math.floor(i / 7) + 1;
        monthsContainer.appendChild(monthLabel);
        currentMonthName = monthName;
      }
    }

    tempDate.setDate(tempDate.getDate() + 1);
  }
}
