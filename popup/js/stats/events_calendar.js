import { calCurrentMonth, calCurrentYear, setCalMonth, setCalYear } from './state.js';
import { renderCalendar } from './calendar.js';

export function bindCalendarEvents(renderStats) {
  const togglePopover = (e) => {
    e.stopPropagation();
    const pop = document.getElementById('stats-calendar-popover');
    if (!pop) return;
    const show = pop.classList.contains('hidden');
    pop.classList.toggle('hidden', !show);
    const panel = pop.closest('.stats-panel');
    if (panel) {
      panel.style.zIndex = show ? '50' : ''; panel.style.position = show ? 'relative' : '';
      panel.classList.toggle('calendar-open', show);
    }
    if (show) renderCalendar(renderStats);
  };

  document.getElementById('stats-date-start')?.addEventListener('click', togglePopover);
  document.getElementById('stats-date-end')?.addEventListener('click', togglePopover);

  document.getElementById('cal-prev-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    let m = calCurrentMonth - 1;
    if (m < 0) { m = 11; setCalYear(calCurrentYear - 1); }
    setCalMonth(m); renderCalendar(renderStats);
  });
  document.getElementById('cal-next-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    let m = calCurrentMonth + 1;
    if (m > 11) { m = 0; setCalYear(calCurrentYear + 1); }
    setCalMonth(m); renderCalendar(renderStats);
  });

  window.addEventListener('click', (e) => {
    const pop = document.getElementById('stats-calendar-popover');
    if (pop && !pop.classList.contains('hidden')) {
      const clickInside = pop.contains(e.target) || e.target.id === 'stats-date-start' || e.target.id === 'stats-date-end' || e.target.closest('.cal-nav-btn');
      if (!clickInside) {
        pop.classList.add('hidden');
        const panel = pop.closest('.stats-panel');
        if (panel) { panel.style.zIndex = ''; panel.style.position = ''; panel.classList.remove('calendar-open'); }
      }
    }
  });
}
