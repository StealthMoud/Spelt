import { getLocalDateString } from '../../../shared/storage.js';
import { calStartDate, calEndDate, setCalStartDate, setCalEndDate } from './state.js';

export function findBucketForDate(dateVal, buckets) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  const time = d.getTime();
  const dateStrDay = getLocalDateString(d);
  const dateStrMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
  return buckets.find(b => {
    if (b.type === 'day') {
      return b.dateStr === dateStrDay;
    } else if (b.type === 'week') {
      return time >= b.weekStart.getTime() && time <= b.weekEnd.getTime();
    } else if (b.type === 'month') {
      return b.dateStr === dateStrMonth;
    }
    return false;
  });
}

export function initCalendarDates() {
  if (!calStartDate) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    setCalStartDate(d);
  }
  if (!calEndDate) {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    setCalEndDate(d);
  }
}

export function updateDateInputs() {
  const startInput = document.getElementById('stats-date-start');
  const endInput = document.getElementById('stats-date-end');
  if (startInput && calStartDate) {
    startInput.value = calStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (endInput && calEndDate) {
    endInput.value = calEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
