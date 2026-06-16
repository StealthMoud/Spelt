import { getWords, getStreak } from '../../shared/storage.js';

/**
 * Initializes the statistics dashboard module
 */
export async function initStats() {
  // Stats is purely read-only, so we just need to render the contents on activation.
  await renderStats();
}

/**
 * Computes metrics and renders the entire statistics panel dynamically
 */
export async function renderStats() {
  try {
    const words = await getWords();
    const streak = await getStreak();

    // 1. Calculate General Summary metrics
    let totalReviews = 0;
    let correctReviews = 0;
    const buttonCounts = { again: 0, hard: 0, good: 0, easy: 0 };
    
    // Group historical reviews by date for the 7-day bar chart
    // We will track the past 7 days: [today - 6 days, ..., today]
    const past7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      past7Days.push({
        dateStr,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        fullDateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        correct: 0,
        incorrect: 0,
        total: 0
      });
    }

    // Process reviews and button distribution
    words.forEach(w => {
      if (Array.isArray(w.history)) {
        w.history.forEach(h => {
          totalReviews++;
          const isCorrect = h.q >= 3;
          if (isCorrect) correctReviews++;

          // Button choice distribution
          if (h.q < 3) buttonCounts.again++;
          else if (h.q === 3) buttonCounts.hard++;
          else if (h.q === 4) buttonCounts.good++;
          else if (h.q === 5) buttonCounts.easy++;

          // Match review to one of the last 7 days
          if (h.date) {
            const reviewDateStr = new Date(h.date).toISOString().split('T')[0];
            const matchingDay = past7Days.find(day => day.dateStr === reviewDateStr);
            if (matchingDay) {
              matchingDay.total++;
              if (isCorrect) {
                matchingDay.correct++;
              } else {
                matchingDay.incorrect++;
              }
            }
          }
        });
      }
    });

    // Retention Rate
    const retentionRate = totalReviews > 0 
      ? Math.round((correctReviews / totalReviews) * 100) 
      : 0;

    // Render general summary stats
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

    // 2. Card States Distribution (Progress segments)
    let newCount = 0;
    let learningCount = 0;
    let matureCount = 0;
    let masteredCount = 0;

    words.forEach(w => {
      if (w.mastered) {
        masteredCount++;
      } else if (w.rep === 0) {
        newCount++;
      } else if (w.interval < 21) {
        learningCount++;
      } else {
        matureCount++;
      }
    });

    const totalCards = words.length || 1; // avoid division by zero
    const pctNew = (newCount / totalCards) * 100;
    const pctLearning = (learningCount / totalCards) * 100;
    const pctMature = (matureCount / totalCards) * 100;
    const pctMastered = (masteredCount / totalCards) * 100;

    // Set segments width
    const newBar = document.getElementById('dist-new-bar');
    const learningBar = document.getElementById('dist-learning-bar');
    const matureBar = document.getElementById('dist-mature-bar');
    const masteredBar = document.getElementById('dist-mastered-bar');

    if (newBar) newBar.style.width = `${pctNew}%`;
    if (learningBar) learningBar.style.width = `${pctLearning}%`;
    if (matureBar) matureBar.style.width = `${pctMature}%`;
    if (masteredBar) masteredBar.style.width = `${pctMastered}%`;

    // Update legends
    const countNewEl = document.getElementById('dist-new-count');
    const countLearningEl = document.getElementById('dist-learning-count');
    const countMatureEl = document.getElementById('dist-mature-count');
    const countMasteredEl = document.getElementById('dist-mastered-count');

    if (countNewEl) countNewEl.textContent = `${newCount} (${Math.round(pctNew)}%)`;
    if (countLearningEl) countLearningEl.textContent = `${learningCount} (${Math.round(pctLearning)}%)`;
    if (countMatureEl) countMatureEl.textContent = `${matureCount} (${Math.round(pctMature)}%)`;
    if (countMasteredEl) countMasteredEl.textContent = `${masteredCount} (${Math.round(pctMastered)}%)`;

    // 3. Render vertical stacked bar chart (Last 7 Days)
    const chartContainer = document.getElementById('stats-chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = '';
      
      // Find the highest review count in any single day to scale heights
      const maxDayReviews = Math.max(...past7Days.map(d => d.total), 1);

      past7Days.forEach(day => {
        const heightPercent = Math.max(0, (day.total / maxDayReviews) * 100);
        const correctPct = day.total > 0 ? (day.correct / day.total) * 100 : 0;
        const incorrectPct = day.total > 0 ? (day.incorrect / day.total) * 100 : 0;

        const col = document.createElement('div');
        col.className = 'bar-column';
        col.innerHTML = `
          <div class="bar-hover-val">${day.total}</div>
          <div class="bar-track">
            ${day.total > 0 ? `
              <div class="bar-fill" style="height: ${heightPercent}%;">
                <div class="bar-segment correct" style="height: ${correctPct}%;" title="${day.correct} Correct on ${day.fullDateLabel}"></div>
                <div class="bar-segment incorrect" style="height: ${incorrectPct}%;" title="${day.incorrect} Incorrect on ${day.fullDateLabel}"></div>
              </div>
            ` : `<div class="bar-fill empty" style="height: 4px;"></div>`}
          </div>
          <span class="bar-label">${day.label}</span>
        `;
        chartContainer.appendChild(col);
      });
    }

    // 4. Render Answer Button Selection distribution
    const btnContainer = document.getElementById('button-dist-list');
    if (btnContainer) {
      btnContainer.innerHTML = '';
      const totalAnswers = Object.values(buttonCounts).reduce((a, b) => a + b, 0) || 1;
      
      const buttons = [
        { key: 'again', name: 'Again', count: buttonCounts.again, cssClass: 'again' },
        { key: 'hard', name: 'Hard', count: buttonCounts.hard, cssClass: 'hard' },
        { key: 'good', name: 'Good', count: buttonCounts.good, cssClass: 'good' },
        { key: 'easy', name: 'Easy', count: buttonCounts.easy, cssClass: 'easy' }
      ];

      buttons.forEach(btn => {
        const pct = Math.round((btn.count / totalAnswers) * 100);
        const row = document.createElement('div');
        row.className = 'btn-dist-row';
        row.innerHTML = `
          <div class="btn-dist-meta">
            <span class="btn-dist-name">${btn.name}</span>
            <span class="btn-dist-count">${btn.count} <small class="text-muted">(${pct}%)</small></span>
          </div>
          <div class="btn-dist-progress-track">
            <div class="btn-dist-progress-fill ${btn.cssClass}" style="width: ${pct}%;"></div>
          </div>
        `;
        btnContainer.appendChild(row);
      });
    }

    // 5. Render Hardest Words (Leech List)
    const leechesList = document.getElementById('stats-leeches-list');
    const leechesEmpty = document.getElementById('stats-leeches-empty');

    if (leechesList) {
      leechesList.innerHTML = '';
      
      // Filter words that have misspelled logs
      const leeches = words
        .filter(w => Array.isArray(w.misspellings) && w.misspellings.length > 0)
        // Sort descending by misspelling count
        .sort((a, b) => b.misspellings.length - a.misspellings.length)
        .slice(0, 10); // top 10 leeches

      if (leeches.length === 0) {
        if (leechesEmpty) leechesEmpty.style.display = 'block';
        leechesList.style.display = 'none';
      } else {
        if (leechesEmpty) leechesEmpty.style.display = 'none';
        leechesList.style.display = 'flex';

        leeches.forEach(w => {
          const uniqueTypos = [...new Set(w.misspellings)];
          const item = document.createElement('li');
          item.className = 'leech-item';
          item.innerHTML = `
            <div class="leech-word-info">
              <span class="leech-word-text">${w.word}</span>
              <span class="leech-count-badge">${w.misspellings.length} error${w.misspellings.length > 1 ? 's' : ''}</span>
            </div>
            <div class="leech-typos">
              Common typos: <span class="leech-typos-list">${uniqueTypos.slice(0, 3).join(', ')}</span>
            </div>
          `;
          leechesList.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Error calculating statistics:', err);
  }
}
