import { getLocalDateString } from '../../../shared/storage.js';
import { calStartDate, calEndDate } from './state.js';
import { initCalendarDates } from './date_buckets.js';

export function buildTimeframeBuckets(timeframe) {
  const chartBuckets = [];
  const today = new Date();
  let barWidth = 20;

  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;
    barWidth = days === 7 ? 20 : 6;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(today.getDate() - i);
      const label = days === 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : (i === 29 ? '30d' : (i === 15 ? '15d' : (i === 0 ? 'Today' : '')));
      chartBuckets.push({
        dateStr: getLocalDateString(d), type: 'day', label,
        fullDateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        correct: 0, incorrect: 0, total: 0
      });
    }
  } else if (timeframe === '6m' || timeframe === '1y') {
    const monthsBack = timeframe === '6m' ? 5 : 11;
    barWidth = timeframe === '6m' ? 22 : 14;
    for (let i = monthsBack; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      chartBuckets.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, type: 'month',
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        fullDateLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        correct: 0, incorrect: 0, total: 0
      });
    }
  } else if (timeframe === 'custom') {
    initCalendarDates();
    let startDate = new Date(calStartDate), endDate = calEndDate ? new Date(calEndDate) : new Date(calStartDate);
    startDate.setHours(0, 0, 0, 0); endDate.setHours(23, 59, 59, 999);
    if (startDate > endDate) { const temp = startDate; startDate = endDate; endDate = temp; }
    const diffDays = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays <= 30) {
      barWidth = Math.min(20, Math.max(4, Math.floor(200 / Math.max(diffDays, 1))));
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateStr = getLocalDateString(current);
        let label = diffDays <= 7 ? current.toLocaleDateString(undefined, { weekday: 'short' }) : '';
        if (diffDays > 7) {
          const curTime = current.getTime(), startVal = startDate.getTime(), endVal = endDate.getTime();
          if (Math.abs(curTime - startVal) < 12*60*60*1000) label = current.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
          else if (Math.abs(curTime - endVal) < 12*60*60*1000) label = 'Today';
        }
        chartBuckets.push({
          dateStr, type: 'day', label,
          fullDateLabel: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          correct: 0, incorrect: 0, total: 0
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (diffDays <= 180) {
      const current = new Date(startDate);
      while (current <= endDate) {
        const weekStart = new Date(current), weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());
        const startLbl = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const endLbl = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        chartBuckets.push({
          dateStr: getLocalDateString(weekStart), weekStart: new Date(weekStart), weekEnd: new Date(weekEnd), type: 'week',
          label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          fullDateLabel: `${startLbl} - ${endLbl}`,
          correct: 0, incorrect: 0, total: 0
        });
        current.setDate(current.getDate() + 7);
      }
      barWidth = Math.min(20, Math.max(6, Math.floor(200 / chartBuckets.length)));
    } else {
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1), limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      while (current <= limit) {
        chartBuckets.push({
          dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`, type: 'month',
          label: current.toLocaleDateString(undefined, { month: 'short' }),
          fullDateLabel: current.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          correct: 0, incorrect: 0, total: 0
        });
        current.setMonth(current.getMonth() + 1);
      }
      barWidth = Math.min(20, Math.max(6, Math.floor(200 / chartBuckets.length)));
    }
  }

  return { chartBuckets, barWidth };
}
