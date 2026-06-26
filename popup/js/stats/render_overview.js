export function renderOverview(totalReviews, correctReviews, streak, cardStates, forecast) {
  const retentionRate = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

  const retentionEl = document.getElementById('stats-retention');
  const retentionSubEl = document.getElementById('stats-retention-sub');
  const totalReviewsEl = document.getElementById('stats-total-reviews');
  const streakEl = document.getElementById('stats-streak');
  const streakSubEl = document.getElementById('stats-streak-sub');

  if (retentionEl) retentionEl.textContent = `${retentionRate}%`;
  if (retentionSubEl) retentionSubEl.textContent = `${correctReviews} / ${totalReviews} correct`;
  if (totalReviewsEl) totalReviewsEl.textContent = totalReviews;
  if (streakEl) streakEl.textContent = `${streak.current || 0}d`;
  if (streakSubEl) streakSubEl.textContent = `best ${streak.max || 0}d`;

  const newBar = document.getElementById('dist-new-bar');
  const learningBar = document.getElementById('dist-learning-bar');
  const matureBar = document.getElementById('dist-mature-bar');
  const masteredBar = document.getElementById('dist-mastered-bar');

  if (newBar) newBar.style.width = `${cardStates.pctNew}%`;
  if (learningBar) learningBar.style.width = `${cardStates.pctLearning}%`;
  if (matureBar) matureBar.style.width = `${cardStates.pctMature}%`;
  if (masteredBar) masteredBar.style.width = `${cardStates.pctMastered}%`;

  const countNewEl = document.getElementById('dist-new-count');
  const countLearningEl = document.getElementById('dist-learning-count');
  const countMatureEl = document.getElementById('dist-mature-count');
  const countMasteredEl = document.getElementById('dist-mastered-count');

  if (countNewEl) countNewEl.textContent = `${cardStates.newCount} (${Math.round(cardStates.pctNew)}%)`;
  if (countLearningEl) countLearningEl.textContent = `${cardStates.learningCount} (${Math.round(cardStates.pctLearning)}%)`;
  if (countMatureEl) countMatureEl.textContent = `${cardStates.matureCount} (${Math.round(cardStates.pctMature)}%)`;
  if (countMasteredEl) countMasteredEl.textContent = `${cardStates.masteredCount} (${Math.round(cardStates.pctMastered)}%)`;

  const forecastTodayEl = document.getElementById('forecast-today');
  const forecastTomorrowEl = document.getElementById('forecast-tomorrow');
  const forecastWeekEl = document.getElementById('forecast-week');
  const forecastMonthEl = document.getElementById('forecast-month');

  if (forecastTodayEl) forecastTodayEl.textContent = forecast.dueToday;
  if (forecastTomorrowEl) forecastTomorrowEl.textContent = forecast.dueTomorrow;
  if (forecastWeekEl) forecastWeekEl.textContent = forecast.dueWeek;
  if (forecastMonthEl) forecastMonthEl.textContent = forecast.dueMonth;
}
