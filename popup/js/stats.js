import { getWords, getStreak } from '../../shared/storage.js';

let currentStatsTimeframe = '7d';
let calCurrentMonth = new Date().getMonth();
let calCurrentYear = new Date().getFullYear();
let calStartDate = null;
let calEndDate = null;

function initCalendarDates() {
  if (!calStartDate) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    calStartDate = d;
  }
  if (!calEndDate) {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    calEndDate = d;
  }
}

function updateDateInputs() {
  const startInput = document.getElementById('stats-date-start');
  const endInput = document.getElementById('stats-date-end');
  if (startInput && calStartDate) {
    startInput.value = calStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (endInput && calEndDate) {
    endInput.value = calEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function renderCalendar() {
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
    cell.addEventListener('click', () => handleCalDayClick(prevDate));
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

    if (curStr === startStr || curStr === endStr) {
      cell.classList.add('selected');
    }
    
    if (calStartDate && calEndDate && time > calStartDate.getTime() && time < calEndDate.getTime()) {
      cell.classList.add('in-range');
      if (curDate.getDay() === 1) cell.classList.add('range-start');
      if (curDate.getDay() === 0) cell.classList.add('range-end');
    }
    
    cell.addEventListener('click', () => handleCalDayClick(curDate));
    daysGrid.appendChild(cell);
  }

  const totalCellsDrawn = firstDay + currentMonthDays;
  const remainingCells = 42 - totalCellsDrawn;
  for (let day = 1; day <= remainingCells; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.textContent = day;
    const nextDate = new Date(calCurrentYear, calCurrentMonth + 1, day);
    cell.addEventListener('click', () => handleCalDayClick(nextDate));
    daysGrid.appendChild(cell);
  }
}

function handleCalDayClick(date) {
  if (!calStartDate || (calStartDate && calEndDate)) {
    calStartDate = new Date(date);
    calStartDate.setHours(0, 0, 0, 0);
    calEndDate = null;
  } else {
    const clickedDate = new Date(date);
    clickedDate.setHours(23, 59, 59, 999);
    
    if (clickedDate < calStartDate) {
      calEndDate = new Date(calStartDate);
      calEndDate.setHours(23, 59, 59, 999);
      calStartDate = clickedDate;
    } else {
      calEndDate = clickedDate;
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
  renderCalendar();
  renderStats().catch(err => console.error(err));
}

/**
 * Initializes the statistics dashboard module
 */
export async function initStats() {
  const select = document.getElementById('stats-timeframe-select');
  const customRange = document.getElementById('stats-custom-range');
  const dateStart = document.getElementById('stats-date-start');
  const dateEnd = document.getElementById('stats-date-end');
  const prevBtn = document.getElementById('cal-prev-btn');
  const nextBtn = document.getElementById('cal-next-btn');

  const timeframeBtn = document.getElementById('stats-timeframe-btn');
  const timeframeDropdown = document.getElementById('stats-timeframe-dropdown');
  const timeframeLabel = document.getElementById('stats-timeframe-label');

  initCalendarDates();
  updateDateInputs();

  function syncCustomSelect() {
    if (!select || !timeframeLabel || !timeframeDropdown) return;
    const val = select.value;
    const activeOpt = timeframeDropdown.querySelector(`.custom-select-option[data-value="${val}"]`);
    if (activeOpt) {
      timeframeLabel.textContent = activeOpt.textContent;
      timeframeDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('active'));
      activeOpt.classList.add('active');
    }
  }

  if (select) {
    select.value = currentStatsTimeframe;
    syncCustomSelect();

    if (timeframeBtn && timeframeDropdown) {
      timeframeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = timeframeDropdown.style.display === 'none';
        timeframeDropdown.style.display = isHidden ? 'block' : 'none';
        
        const headerRow = timeframeBtn.closest('.stats-header-row');
        if (headerRow) {
          headerRow.style.position = 'relative';
          headerRow.style.zIndex = isHidden ? '60' : '';
        }
      });

      timeframeDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.getAttribute('data-value');
          select.value = val;
          syncCustomSelect();
          timeframeDropdown.style.display = 'none';
          
          const headerRow = timeframeBtn.closest('.stats-header-row');
          if (headerRow) {
            headerRow.style.zIndex = '';
          }
          
          select.dispatchEvent(new Event('change'));
        });
      });
    }

    if (customRange) {
      customRange.style.display = currentStatsTimeframe === 'custom' ? 'flex' : 'none';
    }
    select.addEventListener('change', async (e) => {
      currentStatsTimeframe = e.target.value;
      if (customRange) {
        customRange.style.display = currentStatsTimeframe === 'custom' ? 'flex' : 'none';
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
      await renderStats();
    });
  }

  const togglePopover = (e) => {
    e.stopPropagation();
    const popover = document.getElementById('stats-calendar-popover');
    if (popover) {
      const isHidden = popover.style.display === 'none';
      popover.style.display = isHidden ? 'flex' : 'none';
      
      const chartPanel = popover.closest('.stats-panel');
      if (chartPanel) {
        if (isHidden) {
          chartPanel.style.zIndex = '50';
          chartPanel.style.position = 'relative';
          chartPanel.classList.add('calendar-open');
        } else {
          chartPanel.style.zIndex = '';
          chartPanel.style.position = '';
          chartPanel.classList.remove('calendar-open');
        }
      }
      
      if (isHidden) renderCalendar();
    }
  };

  if (dateStart) dateStart.addEventListener('click', togglePopover);
  if (dateEnd) dateEnd.addEventListener('click', togglePopover);

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth--;
      if (calCurrentMonth < 0) {
        calCurrentMonth = 11;
        calCurrentYear--;
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      calCurrentMonth++;
      if (calCurrentMonth > 11) {
        calCurrentMonth = 0;
        calCurrentYear++;
      }
      renderCalendar();
    });
  }

  window.addEventListener('click', (e) => {
    // Close custom select dropdown if open
    if (timeframeDropdown && timeframeDropdown.style.display !== 'none') {
      if (!timeframeBtn.contains(e.target) && !timeframeDropdown.contains(e.target)) {
        timeframeDropdown.style.display = 'none';
        const headerRow = timeframeBtn.closest('.stats-header-row');
        if (headerRow) {
          headerRow.style.zIndex = '';
        }
      }
    }

    // Close calendar popover if open
    const popover = document.getElementById('stats-calendar-popover');
    if (popover && popover.style.display !== 'none') {
      const isClickInside = popover.contains(e.target) || 
                            e.target.id === 'stats-date-start' || 
                            e.target.id === 'stats-date-end' ||
                            e.target.closest('.cal-nav-btn');
      if (!isClickInside) {
        popover.style.display = 'none';
        const chartPanel = popover.closest('.stats-panel');
        if (chartPanel) {
          chartPanel.style.zIndex = '';
          chartPanel.style.position = '';
          chartPanel.classList.remove('calendar-open');
        }
      }
    }
  });

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
    
    const selectEl = document.getElementById('stats-timeframe-select');
    const timeframe = selectEl ? selectEl.value : currentStatsTimeframe;
    
    const chartBuckets = [];
    const today = new Date();
    let barWidth = 20;

    if (timeframe === '7d') {
      barWidth = 20;
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        chartBuckets.push({
          dateStr,
          type: 'day',
          label: d.toLocaleDateString(undefined, { weekday: 'short' }),
          fullDateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          correct: 0,
          incorrect: 0,
          total: 0
        });
      }
    } else if (timeframe === '30d') {
      barWidth = 6;
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        let label = '';
        if (i === 29) label = '30d';
        else if (i === 15) label = '15d';
        else if (i === 0) label = 'Today';

        chartBuckets.push({
          dateStr,
          type: 'day',
          label: label,
          fullDateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          correct: 0,
          incorrect: 0,
          total: 0
        });
      }
    } else if (timeframe === '6m') {
      barWidth = 22;
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        chartBuckets.push({
          dateStr,
          type: 'month',
          label: d.toLocaleDateString(undefined, { month: 'short' }),
          fullDateLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          correct: 0,
          incorrect: 0,
          total: 0
        });
      }
    } else if (timeframe === '1y') {
      barWidth = 14;
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        chartBuckets.push({
          dateStr,
          type: 'month',
          label: d.toLocaleDateString(undefined, { month: 'short' }),
          fullDateLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          correct: 0,
          incorrect: 0,
          total: 0
        });
      }
    } else if (timeframe === 'custom') {
      initCalendarDates();
      
      let startDate = new Date(calStartDate);
      let endDate = calEndDate ? new Date(calEndDate) : new Date(calStartDate);
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      if (startDate > endDate) {
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
      }
      
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays <= 30) {
        barWidth = Math.min(20, Math.max(4, Math.floor(200 / Math.max(diffDays, 1))));
        const current = new Date(startDate);
        while (current <= endDate) {
          const dateStr = current.toISOString().split('T')[0];
          let label = '';
          if (diffDays <= 7) {
            label = current.toLocaleDateString(undefined, { weekday: 'short' });
          } else {
            const curTime = current.getTime();
            const startVal = startDate.getTime();
            const endVal = endDate.getTime();
            const midVal = startVal + (endVal - startVal) / 2;
            const threshold = 12 * 60 * 60 * 1000;
            if (Math.abs(curTime - startVal) < threshold) {
              label = current.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
            } else if (Math.abs(curTime - endVal) < threshold) {
              label = 'Today';
            } else if (Math.abs(curTime - midVal) < threshold) {
              label = current.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
            }
          }
          chartBuckets.push({
            dateStr,
            type: 'day',
            label,
            fullDateLabel: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            correct: 0,
            incorrect: 0,
            total: 0
          });
          current.setDate(current.getDate() + 1);
        }
      } else if (diffDays <= 180) {
        const current = new Date(startDate);
        while (current <= endDate) {
          const weekStart = new Date(current);
          const weekEnd = new Date(current);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (weekEnd > endDate) weekEnd.setTime(endDate.getTime());
          
          chartBuckets.push({
            dateStr: weekStart.toISOString().split('T')[0],
            weekStart: new Date(weekStart),
            weekEnd: new Date(weekEnd),
            type: 'week',
            label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            fullDateLabel: `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            correct: 0,
            incorrect: 0,
            total: 0
          });
          
          current.setDate(current.getDate() + 7);
        }
        barWidth = Math.min(20, Math.max(6, Math.floor(200 / chartBuckets.length)));
      } else {
        const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        while (current <= limit) {
          const year = current.getFullYear();
          const month = current.getMonth();
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}`;
          chartBuckets.push({
            dateStr,
            type: 'month',
            label: current.toLocaleDateString(undefined, { month: 'short' }),
            fullDateLabel: current.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            correct: 0,
            incorrect: 0,
            total: 0
          });
          current.setMonth(current.getMonth() + 1);
        }
        barWidth = Math.min(20, Math.max(6, Math.floor(200 / chartBuckets.length)));
      }
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

          // Match review to one of the buckets
          if (h.date) {
            const rDate = new Date(h.date);
            const rTime = rDate.getTime();
            
            const matchingBucket = chartBuckets.find(b => {
              if (b.type === 'day') {
                return b.dateStr === rDate.toISOString().split('T')[0];
              } else if (b.type === 'week') {
                return rTime >= b.weekStart.getTime() && rTime <= b.weekEnd.getTime();
              } else if (b.type === 'month') {
                return b.dateStr === `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
              }
              return false;
            });

            if (matchingBucket) {
              matchingBucket.total++;
              if (isCorrect) {
                matchingBucket.correct++;
              } else {
                matchingBucket.incorrect++;
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

    // 3. Render vertical stacked bar chart
    const chartContainer = document.getElementById('stats-chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = '';
      
      // Find the highest review count in any single bucket to scale heights
      const maxBucketReviews = Math.max(...chartBuckets.map(b => b.total), 1);

      chartBuckets.forEach(bucket => {
        const heightPercent = Math.max(0, (bucket.total / maxBucketReviews) * 100);
        const correctPct = bucket.total > 0 ? (bucket.correct / bucket.total) * 100 : 0;
        const incorrectPct = bucket.total > 0 ? (bucket.incorrect / bucket.total) * 100 : 0;

        const col = document.createElement('div');
        col.className = 'bar-column';
        col.innerHTML = `
          <div class="bar-hover-val">${bucket.total} ${bucket.total === 1 ? 'review' : 'reviews'}</div>
          <div class="bar-track" style="width: ${barWidth}px;">
            ${bucket.total > 0 ? `
              <div class="bar-fill" style="height: ${heightPercent}%;">
                <div class="bar-segment correct" style="height: ${correctPct}%;" title="${bucket.correct} Correct ${bucket.type === 'day' ? 'on' : 'during'} ${bucket.fullDateLabel}"></div>
                <div class="bar-segment incorrect" style="height: ${incorrectPct}%;" title="${bucket.incorrect} Incorrect ${bucket.type === 'day' ? 'on' : 'during'} ${bucket.fullDateLabel}"></div>
              </div>
            ` : `<div class="bar-fill empty" style="height: 4px;"></div>`}
          </div>
          <span class="bar-label">${bucket.label}</span>
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
      
      // Filter words that have misspelled logs and are not mastered
      const leeches = words
        .filter(w => !w.mastered && Array.isArray(w.misspellings) && w.misspellings.length > 0)
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
          const uniqueTypos = [...new Set(w.misspellings)].filter(Boolean);
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
