import { drawSparkline } from './sparkline.js';

export function renderResponseTime(globalRtSum, globalRtCount, globalRtMin, globalRtMax, chartBuckets) {
  const avgEl = document.getElementById('rt-avg');
  const fastestEl = document.getElementById('rt-fastest');
  const slowestEl = document.getElementById('rt-slowest');
  const emptyMsg = document.getElementById('rt-empty-msg');
  const trendContainer = document.getElementById('rt-trend-container');

  const formatRt = (ms) => {
    if (ms === Infinity || ms === 0 || isNaN(ms)) return '--';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  if (globalRtCount > 0) {
    if (avgEl) avgEl.textContent = formatRt(globalRtSum / globalRtCount);
    if (fastestEl) fastestEl.textContent = formatRt(globalRtMin);
    if (slowestEl) slowestEl.textContent = formatRt(globalRtMax);
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (trendContainer) trendContainer.style.display = 'flex';

    const rtPoints = chartBuckets.map(b => b.rtCount > 0 ? Math.round(b.rtSum / b.rtCount) : 0);
    const rtLabels = chartBuckets.map(b => b.fullDateLabel);
    drawSparkline('rt-trend-container', rtPoints, 320, 75, {
      strokeColor: 'hsl(265, 80%, 65%)', dotColor: 'hsl(265, 80%, 72%)',
      labels: rtLabels, unit: 'ms avg response'
    });
  } else {
    if (avgEl) avgEl.textContent = '--';
    if (fastestEl) fastestEl.textContent = '--';
    if (slowestEl) slowestEl.textContent = '--';
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (trendContainer) trendContainer.style.display = 'none';
  }
}

export function renderStudyTime(globalRtSum, globalRtCount, todayStudyTimeMs, sessions, chartBuckets) {
  const elTotal = document.getElementById('study-total-time');
  const elAvg = document.getElementById('study-avg-session');
  const elToday = document.getElementById('study-today-time');
  const trendContainer = document.getElementById('study-trend-container');
  const emptyMsg = document.getElementById('study-empty-msg');

  const formatStudyTime = (ms) => {
    if (!ms || isNaN(ms)) return '0s';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  if (sessions && sessions.length > 0) {
    const totalMs = sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    const avgMs = totalMs / sessions.length;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const todayMs = sessions.filter(s => s.startTime >= startOfToday).reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

    if (elTotal) elTotal.textContent = formatStudyTime(totalMs);
    if (elToday) elToday.textContent = formatStudyTime(todayMs);
    if (elAvg) {
      elAvg.textContent = avgMs / 1000 / 60 < 1 ? `${Math.round(avgMs / 1000)}s` : `${(avgMs / 1000 / 60).toFixed(1)}m`;
      if (elAvg.nextElementSibling) elAvg.nextElementSibling.textContent = 'Avg Session';
    }
  } else {
    if (elTotal) elTotal.textContent = formatStudyTime(globalRtSum);
    if (elToday) elToday.textContent = formatStudyTime(todayStudyTimeMs);
    if (elAvg) {
      elAvg.textContent = globalRtCount > 0 ? (globalRtSum / globalRtCount < 1000 ? `${Math.round(globalRtSum / globalRtCount)}ms` : `${(globalRtSum / globalRtCount / 1000).toFixed(1)}s`) : '--';
      if (elAvg.nextElementSibling) elAvg.nextElementSibling.textContent = 'Avg per Review';
    }
  }

  const hasData = (sessions && sessions.length > 0) || globalRtCount > 0;
  if (hasData) {
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (trendContainer) {
      trendContainer.style.display = 'flex';
      const points = chartBuckets.map(b => Number((b.studyTimeMs / 1000 / 60).toFixed(1)));
      const labels = chartBuckets.map(b => b.fullDateLabel);
      drawSparkline('study-trend-container', points, 320, 75, {
        strokeColor: 'hsl(175, 75%, 45%)', dotColor: 'hsl(175, 75%, 72%)',
        labels, unit: 'm study time'
      });
    }
  } else {
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (trendContainer) trendContainer.style.display = 'none';
  }
}
