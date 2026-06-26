import { drawSparkline } from './sparkline.js';

export function renderVelocity(words, chartBuckets, masteredCount) {
  const velThisWeek = words.filter(w => w.createdAt && (Date.now() - w.createdAt <= 7 * 24 * 3600 * 1000)).length;
  const velThisMonth = words.filter(w => w.createdAt && (Date.now() - w.createdAt <= 30 * 24 * 3600 * 1000)).length;
  
  const elWeek = document.getElementById('velocity-this-week');
  const elMonth = document.getElementById('velocity-this-month');
  const elTotal = document.getElementById('velocity-total');
  const elMastered = document.getElementById('velocity-mastered');

  if (elWeek) elWeek.textContent = velThisWeek;
  if (elMonth) elMonth.textContent = velThisMonth;
  if (elTotal) elTotal.textContent = words.length;
  if (elMastered) elMastered.textContent = masteredCount;

  const velPoints = chartBuckets.map(b => b.created);
  const velLabels = chartBuckets.map(b => b.fullDateLabel);
  drawSparkline('velocity-chart-container', velPoints, 320, 65, {
    strokeColor: 'hsl(155, 65%, 48%)', dotColor: 'hsl(155, 80%, 72%)',
    labels: velLabels, unit: ' words added'
  });
}

export function renderAccuracyTrend(chartBuckets) {
  const accPoints = chartBuckets.map(b => b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0);
  const accLabels = chartBuckets.map(b => b.fullDateLabel);
  drawSparkline('accuracy-trend-container', accPoints, 320, 75, {
    strokeColor: 'hsl(145, 80%, 45%)', dotColor: 'hsl(145, 80%, 72%)',
    labels: accLabels, unit: '% accuracy'
  });

  const active = chartBuckets.filter(b => b.total > 0);
  const avg = active.length > 0 ? Math.round((active.reduce((acc, b) => acc + b.correct, 0) / active.reduce((acc, b) => acc + b.total, 0)) * 100) : null;
  const peak = active.length > 0 ? Math.max(...active.map(b => Math.round((b.correct / b.total) * 100))) : null;
  const summaryEl = document.getElementById('accuracy-trend-summary');
  if (summaryEl) {
    summaryEl.textContent = avg !== null ? `Avg Period Accuracy: ${avg}% (Peak: ${peak}%)` : 'No review activities recorded in this timeframe.';
  }
}

export function renderSandboxActivity(globalSandboxChecks, globalSandboxCorrect, globalSandboxToday, chartBuckets) {
  const elTotal = document.getElementById('sandbox-total-checks');
  const elRate = document.getElementById('sandbox-correct-rate');
  const elToday = document.getElementById('sandbox-today-checks');
  const emptyMsg = document.getElementById('sandbox-empty-msg');
  const chart = document.getElementById('sandbox-activity-chart');

  if (globalSandboxChecks > 0) {
    if (elTotal) elTotal.textContent = globalSandboxChecks;
    if (elRate) elRate.textContent = `${Math.round((globalSandboxCorrect / globalSandboxChecks) * 100)}%`;
    if (elToday) elToday.textContent = globalSandboxToday;
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (chart) chart.style.display = 'flex';

    const points = chartBuckets.map(b => b.sandboxChecks);
    const labels = chartBuckets.map(b => b.fullDateLabel);
    drawSparkline('sandbox-activity-chart', points, 320, 65, {
      strokeColor: 'hsl(38, 92%, 50%)', dotColor: 'hsl(38, 92%, 72%)',
      labels, unit: ' checks'
    });
  } else {
    if (elTotal) elTotal.textContent = '0';
    if (elRate) elRate.textContent = '--';
    if (elToday) elToday.textContent = '0';
    if (emptyMsg) emptyMsg.style.display = 'block';
    if (chart) chart.style.display = 'none';
  }
}
