import { calCurrentMonth, calCurrentYear, calStartDate, calEndDate, setCalStartDate, setCalEndDate } from './state.js';
import { updateDateInputs } from './date_buckets.js';

export function renderCalendar(renderStatsCallback) {
  const monthYearEl = document.getElementById('cal-month-year');
  const daysGrid = document.getElementById('cal-days-grid');
  if (!monthYearEl || !daysGrid) return;

  const tempDate = new Date(calCurrentYear, calCurrentMonth, 1);
  monthYearEl.textContent = tempDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  daysGrid.innerHTML = '';

  const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
  const firstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const prevMonthDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();
  const currentMonthDays = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();

  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.textContent = day;
    const prevDate = new Date(calCurrentYear, calCurrentMonth - 1, day);
    cell.addEventListener('click', () => handleCalDayClick(prevDate, renderStatsCallback));
    daysGrid.appendChild(cell);
  }

  for (let day = 1; day <= currentMonthDays; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    cell.textContent = day;
    
    const curDate = new Date(calCurrentYear, calCurrentMonth, day);
    const time = curDate.getTime();
    const startStr = calStartDate ? calStartDate.toDateString() : '';
    const endStr = calEndDate ? calEndDate.toDateString() : '';
    const curStr = curDate.toDateString();

    if (curStr === startStr || curStr === endStr) cell.classList.add('selected');
    if (calStartDate && calEndDate && time > calStartDate.getTime() && time < calEndDate.getTime()) {
      cell.classList.add('in-range');
      if (curDate.getDay() === 1) cell.classList.add('range-start');
      if (curDate.getDay() === 0) cell.classList.add('range-end');
    }
    
    cell.addEventListener('click', () => handleCalDayClick(curDate, renderStatsCallback));
    daysGrid.appendChild(cell);
  }

  const remainingCells = 42 - (firstDay + currentMonthDays);
  for (let day = 1; day <= remainingCells; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.textContent = day;
    const nextDate = new Date(calCurrentYear, calCurrentMonth + 1, day);
    cell.addEventListener('click', () => handleCalDayClick(nextDate, renderStatsCallback));
    daysGrid.appendChild(cell);
  }
}

export function handleCalDayClick(date, renderStatsCallback) {
  if (!calStartDate || (calStartDate && calEndDate)) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    setCalStartDate(start);
    setCalEndDate(null);
  } else {
    const clickedDate = new Date(date);
    clickedDate.setHours(23, 59, 59, 999);
    
    if (clickedDate < calStartDate) {
      const end = new Date(calStartDate);
      end.setHours(23, 59, 59, 999);
      setCalEndDate(end);
      setCalStartDate(clickedDate);
    } else {
      setCalEndDate(clickedDate);
    }
    
    const popover = document.getElementById('stats-calendar-popover');
    if (popover) {
      popover.style.display = 'none';
      const chartPanel = popover.closest('.stats-panel');
      if (chartPanel) {
        chartPanel.style.zIndex = '';
        chartPanel.style.position = '';
        chartPanel.classList.remove('calendar-open');
      }
    }
  }
  
  updateDateInputs();
  renderCalendar(renderStatsCallback);
  if (renderStatsCallback) renderStatsCallback().catch(err => console.error(err));
}
