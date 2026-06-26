import { getWords, getStreak, getSandboxActivity, getSessions } from '../../shared/storage.js';
import {
  currentStatsTimeframe, currentLeechesLimit, currentLeechesCustomVal,
  setLeechesLimit, setLeechesCustomVal
} from './stats/state.js';
import { initCalendarDates, updateDateInputs } from './stats/date_buckets.js';
import { buildTimeframeBuckets } from './stats/timeframe_buckets.js';
import { calculateSummary } from './stats/summary_calc.js';
import { calculateCardStates, calculateForecast } from './stats/states_calc.js';
import { renderOverview } from './stats/render_overview.js';
import { renderReviewChart, renderButtonDistribution, renderCEFRDistribution } from './stats/render_charts.js';
import { renderHeatmap } from './stats/render_heatmap.js';
import { renderVelocity, renderAccuracyTrend, renderSandboxActivity } from './stats/render_velocity.js';
import { renderResponseTime, renderStudyTime } from './stats/render_time_metrics.js';
import { renderLeeches } from './stats/render_leeches.js';
import { bindCalendarEvents } from './stats/events_calendar.js';
import { bindUiEvents } from './stats/events_ui.js';

export async function initStats() {
  initCalendarDates();
  updateDateInputs();

  try {
    const res = await chrome.storage?.local.get(['spelt_leeches_limit', 'spelt_leeches_custom_val']);
    setLeechesLimit(res?.spelt_leeches_limit || '10');
    setLeechesCustomVal(res?.spelt_leeches_custom_val || 15);
  } catch (_) {}

  const limitSelect = document.getElementById('stats-leeches-limit');
  const customInput = document.getElementById('stats-leeches-custom-val');
  const customContainer = document.getElementById('stats-leeches-custom-container');
  if (limitSelect) limitSelect.value = currentLeechesLimit;
  if (customInput) customInput.value = currentLeechesCustomVal;
  if (customContainer) customContainer.style.display = currentLeechesLimit === 'custom' ? 'flex' : 'none';

  bindCalendarEvents(renderStats);
  bindUiEvents(renderStats);

  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.spelt_leeches_limit) {
        setLeechesLimit(changes.spelt_leeches_limit.newValue || '10');
        if (limitSelect) limitSelect.value = currentLeechesLimit;
        if (customContainer) customContainer.style.display = currentLeechesLimit === 'custom' ? 'flex' : 'none';
        renderStats();
      }
      if (changes.spelt_leeches_custom_val) {
        setLeechesCustomVal(changes.spelt_leeches_custom_val.newValue || 15);
        if (customInput) customInput.value = currentLeechesCustomVal;
        renderStats();
      }
    }
  });

  await renderStats();
}

export async function renderStats() {
  try {
    const words = await getWords();
    const streak = await getStreak();
    const sandboxActivity = await getSandboxActivity();
    const sessions = await getSessions();

    const timeframe = document.getElementById('stats-timeframe-select')?.value || currentStatsTimeframe;
    const { chartBuckets, barWidth } = buildTimeframeBuckets(timeframe);

    const summary = calculateSummary(words, sandboxActivity, chartBuckets);
    const cardStates = calculateCardStates(words);
    const forecast = calculateForecast(words);

    renderOverview(summary.totalReviews, summary.correctReviews, streak, cardStates, forecast);
    renderReviewChart(chartBuckets, barWidth);
    renderButtonDistribution(summary.buttonCounts);
    renderCEFRDistribution(words);
    renderHeatmap(summary.reviewActivity);

    renderVelocity(words, chartBuckets, cardStates.masteredCount);
    renderAccuracyTrend(chartBuckets);
    renderSandboxActivity(summary.globalSandboxChecks, summary.globalSandboxCorrect, summary.globalSandboxToday, chartBuckets);
    renderResponseTime(summary.globalRtSum, summary.globalRtCount, summary.globalRtMin, summary.globalRtMax, chartBuckets);
    renderStudyTime(summary.globalRtSum, summary.globalRtCount, summary.todayStudyTimeMs, sessions);
    renderLeeches(words, currentLeechesLimit, currentLeechesCustomVal);
  } catch (err) {
    console.error('Error calculating statistics:', err);
  }
}
