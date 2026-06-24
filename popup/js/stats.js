import { getWords, getStreak, getSandboxActivity, getSessions, getLocalDateString } from '../../shared/storage.js';

let statsTooltipEl = null;

function showStatsTooltip(x, y, text) {
  if (!statsTooltipEl) {
    statsTooltipEl = document.createElement('div');
    statsTooltipEl.className = 'stats-tooltip';
    document.body.appendChild(statsTooltipEl);
  }
  statsTooltipEl.innerHTML = text;
  statsTooltipEl.style.left = `${x}px`;
  statsTooltipEl.style.top = `${y}px`;
  statsTooltipEl.classList.add('visible');
}

function hideStatsTooltip() {
  if (statsTooltipEl) {
    statsTooltipEl.classList.remove('visible');
  }
}

function findBucketForDate(dateVal, buckets) {
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

function drawSparkline(containerId, dataPoints, width = 300, height = 60, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  if (dataPoints.length === 0 || Math.max(...dataPoints, 0) === 0) {
    container.innerHTML = '<div class="leeches-empty-text">No activity data in this period.</div>';
    return;
  }
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.overflow = 'visible';
  
  const maxVal = Math.max(...dataPoints, 1);
  const minVal = 0; // always baseline at 0 for learning metrics
  const range = maxVal - minVal;
  
  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 8;
  const paddingBottom = 8;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const points = dataPoints.map((val, idx) => {
    const x = paddingLeft + (idx / Math.max(dataPoints.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - minVal) / range) * chartHeight;
    return { x, y, val };
  });
  
  // Create path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', options.strokeColor || 'var(--primary)');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  
  // Fill under path
  let areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaD);
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  const gradId = `spark-grad-${Math.random().toString(36).substr(2, 9)}`;
  gradient.setAttribute('id', gradId);
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '0%');
  gradient.setAttribute('y2', '100%');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', options.strokeColor || 'var(--primary)');
  stop1.setAttribute('stop-opacity', '0.2');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', options.strokeColor || 'var(--primary)');
  stop2.setAttribute('stop-opacity', '0');
  
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);
  
  area.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(area);
  svg.appendChild(path);
  
  // Draw interactive dots
  points.forEach((pt, idx) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt.x.toString());
    circle.setAttribute('cy', pt.y.toString());
    circle.setAttribute('r', '2.5');
    circle.setAttribute('fill', options.dotColor || 'var(--primary-light)');
    circle.setAttribute('stroke', 'var(--bg-dark)');
    circle.setAttribute('stroke-width', '1');
    
    circle.style.cursor = 'pointer';
    circle.style.transition = 'all var(--transition-fast) ease';
    
    const label = options.labels ? options.labels[idx] : pt.val.toString();
    const tooltipText = `<strong>${label}</strong><br/>${pt.val}${options.unit || ''}`;
    
    circle.addEventListener('mouseenter', (e) => {
      circle.setAttribute('r', '4.5');
      showStatsTooltip(e.clientX, e.clientY, tooltipText);
    });
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('r', '2.5');
      hideStatsTooltip();
    });
    
    svg.appendChild(circle);
  });
  
  container.appendChild(svg);
}

let currentStatsTimeframe = '7d';
let currentLeechesLimit = '10';
let currentLeechesCustomVal = 15;
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
  // Stats Sub-tabs navigation
  const subtabBtns = document.querySelectorAll('.stats-subtab-btn');
  const subtabPanes = document.querySelectorAll('.stats-subtab-content');
  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-subtab');
      
      subtabBtns.forEach(b => b.classList.remove('active'));
      subtabPanes.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      
      btn.classList.add('active');
      const targetEl = document.getElementById(`stats-subtab-${target}`);
      if (targetEl) {
        targetEl.classList.add('active');
        targetEl.style.display = 'flex';
      }
    });
  });

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

  // Load leeches limit settings synchronously/blocking before first render
  try {
    const res = await chrome.storage?.local.get(['spelt_leeches_limit', 'spelt_leeches_custom_val']);
    currentLeechesLimit = res?.spelt_leeches_limit || '10';
    currentLeechesCustomVal = res?.spelt_leeches_custom_val || 15;
  } catch (_) {}

  const limitSelect = document.getElementById('stats-leeches-limit');
  const customInput = document.getElementById('stats-leeches-custom-val');
  const customContainer = document.getElementById('stats-leeches-custom-container');
  if (limitSelect) limitSelect.value = currentLeechesLimit;
  if (customInput) customInput.value = currentLeechesCustomVal;
  if (customContainer) {
    customContainer.style.display = currentLeechesLimit === 'custom' ? 'flex' : 'none';
  }

  document.getElementById('stats-leeches-limit')?.addEventListener('change', (e) => {
    currentLeechesLimit = e.target.value;
    chrome.storage?.local.set({ spelt_leeches_limit: currentLeechesLimit });
    const cContainer = document.getElementById('stats-leeches-custom-container');
    if (cContainer) {
      cContainer.style.display = currentLeechesLimit === 'custom' ? 'flex' : 'none';
    }
    renderStats().catch(err => console.error(err));
  });

  document.getElementById('stats-leeches-custom-val')?.addEventListener('input', (e) => {
    currentLeechesCustomVal = parseInt(e.target.value, 10) || 15;
    chrome.storage?.local.set({ spelt_leeches_custom_val: currentLeechesCustomVal });
    renderStats().catch(err => console.error(err));
  });

  document.getElementById('stats-leeches-dec-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById('stats-leeches-custom-val');
    if (input) {
      const newVal = Math.max(1, (parseInt(input.value, 10) || 15) - 1);
      input.value = newVal;
      input.dispatchEvent(new Event('input'));
    }
  });

  document.getElementById('stats-leeches-inc-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById('stats-leeches-custom-val');
    if (input) {
      const newVal = Math.min(500, (parseInt(input.value, 10) || 15) + 1);
      input.value = newVal;
      input.dispatchEvent(new Event('input'));
    }
  });

  // Listen for storage changes in real-time
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.spelt_leeches_limit) {
        currentLeechesLimit = changes.spelt_leeches_limit.newValue || '10';
        const el = document.getElementById('stats-leeches-limit');
        if (el) el.value = currentLeechesLimit;
        const cContainer = document.getElementById('stats-leeches-custom-container');
        if (cContainer) {
          cContainer.style.display = currentLeechesLimit === 'custom' ? 'flex' : 'none';
        }
        renderStats().catch(err => console.error(err));
      }
      if (changes.spelt_leeches_custom_val) {
        currentLeechesCustomVal = changes.spelt_leeches_custom_val.newValue || 15;
        const cInput = document.getElementById('stats-leeches-custom-val');
        if (cInput) cInput.value = currentLeechesCustomVal;
        renderStats().catch(err => console.error(err));
      }
    }
  });

  await renderStats();
}

/**
 * Computes metrics and renders the entire statistics panel dynamically
 */
/**
 * Computes metrics and renders the entire statistics panel dynamically
 */
export async function renderStats() {
  try {
    const words = await getWords();
    const streak = await getStreak();
    const sandboxActivity = await getSandboxActivity();

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
        const dateStr = getLocalDateString(d);
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
        const dateStr = getLocalDateString(d);
        
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
          const dateStr = getLocalDateString(current);
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
            dateStr: getLocalDateString(weekStart),
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

    // Initialize additional fields for each bucket
    chartBuckets.forEach(b => {
      b.created = 0;
      b.rtSum = 0;
      b.rtCount = 0;
      b.sandboxChecks = 0;
      b.sandboxCorrect = 0;
    });

    // Global Response Time & Study Time metrics
    const reviewActivity = {};
    let globalRtSum = 0;
    let globalRtCount = 0;
    let globalRtMax = 0;
    let globalRtMin = Infinity;
    let todayStudyTimeMs = 0;
    const todayDateStr = getLocalDateString();

    // Process reviews, response times, button distribution, and created words
    words.forEach(w => {
      // Binned words created
      if (w.createdAt) {
        const b = findBucketForDate(w.createdAt, chartBuckets);
        if (b) {
          b.created++;
        }
      }

      if (Array.isArray(w.history)) {
        w.history.forEach(h => {
          totalReviews++;
          const isCorrect = h.q >= 3;
          if (isCorrect) correctReviews++;

          // Track review activity per date
          if (h.date) {
            const hDateStr = (typeof h.date === 'string' && h.date.includes('-'))
              ? h.date
              : getLocalDateString(new Date(Number(h.date)));
            reviewActivity[hDateStr] = (reviewActivity[hDateStr] || 0) + 1;
          }

          // Button choice distribution
          if (h.q < 3) buttonCounts.again++;
          else if (h.q === 3) buttonCounts.hard++;
          else if (h.q === 4) buttonCounts.good++;
          else if (h.q === 5) buttonCounts.easy++;

          // Response time parsing
          if (h.rt && typeof h.rt === 'number') {
            globalRtSum += h.rt;
            globalRtCount++;
            if (h.rt > globalRtMax) globalRtMax = h.rt;
            if (h.rt < globalRtMin) globalRtMin = h.rt;

            // Today's study time
            if (h.date) {
              const hDateStr = (typeof h.date === 'string' && h.date.includes('-'))
                ? h.date
                : getLocalDateString(new Date(Number(h.date)));
              if (hDateStr === todayDateStr) {
                todayStudyTimeMs += h.rt;
              }
            }

            const bRt = findBucketForDate(h.date, chartBuckets);
            if (bRt) {
              bRt.rtSum += h.rt;
              bRt.rtCount++;
            }
          }

          // Match review to one of the buckets
          if (h.date) {
            const rDate = new Date(h.date);
            const rTime = rDate.getTime();
            
            const matchingBucket = chartBuckets.find(b => {
              if (b.type === 'day') {
                return b.dateStr === getLocalDateString(rDate);
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

    // Process Sandbox Activity data
    let globalSandboxChecks = 0;
    let globalSandboxCorrect = 0;
    let globalSandboxToday = 0;

    Object.entries(sandboxActivity).forEach(([dateKey, stats]) => {
      const checks = stats.checks || 0;
      const correct = stats.correct || 0;
      globalSandboxChecks += checks;
      globalSandboxCorrect += correct;
      
      if (dateKey === todayDateStr) {
        globalSandboxToday = checks;
      }
      
      const bSandbox = findBucketForDate(new Date(dateKey), chartBuckets);
      if (bSandbox) {
        bSandbox.sandboxChecks += checks;
        bSandbox.sandboxCorrect += correct;
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

    // 2.5 Calculate Upcoming Review Forecast
    let dueToday = 0;
    let dueTomorrow = 0;
    let dueWeek = 0;
    let dueMonth = 0;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    words.forEach(w => {
      if (!w.mastered) {
        const diff = w.nextDate - now;
        if (diff <= 0) {
          dueToday++;
        } else if (diff <= oneDay) {
          dueTomorrow++;
        } else if (diff <= sevenDays) {
          dueWeek++;
        } else if (diff <= thirtyDays) {
          dueMonth++;
        }
      }
    });

    const forecastTodayEl = document.getElementById('forecast-today');
    const forecastTomorrowEl = document.getElementById('forecast-tomorrow');
    const forecastWeekEl = document.getElementById('forecast-week');
    const forecastMonthEl = document.getElementById('forecast-month');

    if (forecastTodayEl) forecastTodayEl.textContent = dueToday;
    if (forecastTomorrowEl) forecastTomorrowEl.textContent = dueTomorrow;
    if (forecastWeekEl) forecastWeekEl.textContent = dueWeek;
    if (forecastMonthEl) forecastMonthEl.textContent = dueMonth;

    // 3. Render vertical stacked bar chart (Review Counts)
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

    // NEW PANEL 1: Activity Heatmap
    const heatmapContainer = document.getElementById('stats-heatmap-container');
    const monthsContainer = document.getElementById('stats-heatmap-months');
    const heatmapYearEl = document.getElementById('stats-heatmap-year');
    if (heatmapContainer) {
      heatmapContainer.innerHTML = '';
      if (monthsContainer) monthsContainer.innerHTML = '';

      const tempDate = new Date();
      const endYear = tempDate.getFullYear();
      
      // Go back 53 weeks (371 days) and align the start to a Monday to prevent jagged grid columns
      const dayOfWeek = tempDate.getDay();
      const offsetDays = 364 + (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      tempDate.setDate(tempDate.getDate() - offsetDays);
      const startYear = tempDate.getFullYear();

      // Display Year Range
      if (heatmapYearEl) {
        heatmapYearEl.textContent = startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;
      }

      let currentMonthName = '';
      const totalDays = 371; // 53 weeks * 7 days

      for (let i = 0; i < totalDays; i++) {
        const dateStr = getLocalDateString(tempDate);
        const count = reviewActivity[dateStr] || 0;

        let level = 0;
        if (count > 0 && count <= 3) level = 1;
        else if (count > 3 && count <= 8) level = 2;
        else if (count > 8 && count <= 15) level = 3;
        else if (count > 15) level = 4;

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.setAttribute('data-level', level.toString());

        const formattedDate = tempDate.toLocaleDateString(undefined, { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        const tooltipText = `<strong>${formattedDate}</strong><br/>${count} review${count === 1 ? '' : 's'}`;

        cell.addEventListener('mouseenter', (e) => {
          showStatsTooltip(e.clientX, e.clientY, tooltipText);
        });
        cell.addEventListener('mouseleave', () => {
          hideStatsTooltip();
        });

        heatmapContainer.appendChild(cell);

        // Dynamically insert Month labels above the correct columns (weeks starting on Monday)
        if (i % 7 === 0 && monthsContainer) {
          const monthName = tempDate.toLocaleDateString(undefined, { month: 'short' });
          if (monthName !== currentMonthName) {
            const monthLabel = document.createElement('span');
            monthLabel.className = 'heatmap-month-label';
            monthLabel.textContent = monthName;
            monthLabel.style.gridColumnStart = Math.floor(i / 7) + 1;
            monthsContainer.appendChild(monthLabel);
            currentMonthName = monthName;
          }
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }
    }

    // NEW PANEL 2: Learning Velocity
    const velThisWeek = words.filter(w => w.createdAt && (Date.now() - w.createdAt <= 7 * 24 * 60 * 60 * 1000)).length;
    const velThisMonth = words.filter(w => w.createdAt && (Date.now() - w.createdAt <= 30 * 24 * 60 * 60 * 1000)).length;
    
    const velocityThisWeekEl = document.getElementById('velocity-this-week');
    const velocityThisMonthEl = document.getElementById('velocity-this-month');
    const velocityTotalEl = document.getElementById('velocity-total');
    const velocityMasteredEl = document.getElementById('velocity-mastered');

    if (velocityThisWeekEl) velocityThisWeekEl.textContent = velThisWeek;
    if (velocityThisMonthEl) velocityThisMonthEl.textContent = velThisMonth;
    if (velocityTotalEl) velocityTotalEl.textContent = words.length;
    if (velocityMasteredEl) velocityMasteredEl.textContent = masteredCount;

    const velPoints = chartBuckets.map(b => b.created);
    const velLabels = chartBuckets.map(b => b.fullDateLabel);
    drawSparkline('velocity-chart-container', velPoints, 320, 65, {
      strokeColor: 'hsl(155, 65%, 48%)',
      dotColor: 'hsl(155, 80%, 72%)',
      labels: velLabels,
      unit: ' words added'
    });

    // NEW PANEL 3: Accuracy Trend
    const accPoints = chartBuckets.map(b => b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0);
    const accLabels = chartBuckets.map(b => b.fullDateLabel);
    drawSparkline('accuracy-trend-container', accPoints, 320, 75, {
      strokeColor: 'hsl(145, 80%, 45%)',
      dotColor: 'hsl(145, 80%, 72%)',
      labels: accLabels,
      unit: '% accuracy'
    });

    const activeAccBuckets = chartBuckets.filter(b => b.total > 0);
    const avgPeriodAcc = activeAccBuckets.length > 0 
      ? Math.round((activeAccBuckets.reduce((acc, b) => acc + b.correct, 0) / activeAccBuckets.reduce((acc, b) => acc + b.total, 0)) * 100)
      : null;
    const peakPeriodAcc = activeAccBuckets.length > 0 ? Math.max(...activeAccBuckets.map(b => Math.round((b.correct / b.total) * 100))) : null;
    const accuracyTrendSummaryEl = document.getElementById('accuracy-trend-summary');
    if (accuracyTrendSummaryEl) {
      if (avgPeriodAcc !== null) {
        accuracyTrendSummaryEl.textContent = `Avg Period Accuracy: ${avgPeriodAcc}% (Peak: ${peakPeriodAcc}%)`;
      } else {
        accuracyTrendSummaryEl.textContent = 'No review activities recorded in this timeframe.';
      }
    }

    // NEW PANEL 4: CEFR Level Distribution
    const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, Unknown: 0 };
    words.forEach(w => {
      const lvl = (w.level || '').toUpperCase().trim();
      if (cefrCounts[lvl] !== undefined) {
        cefrCounts[lvl]++;
      } else {
        cefrCounts.Unknown++;
      }
    });

    const cefrContainer = document.getElementById('cefr-dist-container');
    if (cefrContainer) {
      cefrContainer.innerHTML = '';
      const totalWithLevel = Object.values(cefrCounts).reduce((a, b) => a + b, 0) || 1;
      const levelsToShow = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (cefrCounts.Unknown > 0) {
        levelsToShow.push('Unknown');
      }

      levelsToShow.forEach(lvl => {
        const count = cefrCounts[lvl];
        const pct = Math.round((count / totalWithLevel) * 100);
        
        const row = document.createElement('div');
        row.className = 'cefr-row';
        row.innerHTML = `
          <span class="cefr-label-badge">${lvl === 'Unknown' ? '?' : lvl}</span>
          <div class="cefr-bar-wrapper">
            <div class="cefr-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="cefr-count-label">${count} (${pct}%)</span>
        `;
        cefrContainer.appendChild(row);
      });
    }

    // NEW PANEL 5: Response Time Insights
    const avgRtEl = document.getElementById('rt-avg');
    const fastestRtEl = document.getElementById('rt-fastest');
    const slowestRtEl = document.getElementById('rt-slowest');
    const rtEmptyMsg = document.getElementById('rt-empty-msg');
    const rtTrendContainer = document.getElementById('rt-trend-container');

    const formatRt = (ms) => {
      if (ms === Infinity || ms === 0 || isNaN(ms)) return '--';
      if (ms < 1000) return `${Math.round(ms)}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    if (globalRtCount > 0) {
      if (avgRtEl) avgRtEl.textContent = formatRt(globalRtSum / globalRtCount);
      if (fastestRtEl) fastestRtEl.textContent = formatRt(globalRtMin);
      if (slowestRtEl) slowestRtEl.textContent = formatRt(globalRtMax);
      if (rtEmptyMsg) rtEmptyMsg.style.display = 'none';
      if (rtTrendContainer) rtTrendContainer.style.display = 'flex';

      const rtPoints = chartBuckets.map(b => b.rtCount > 0 ? Math.round(b.rtSum / b.rtCount) : 0);
      const rtLabels = chartBuckets.map(b => b.fullDateLabel);
      drawSparkline('rt-trend-container', rtPoints, 320, 75, {
        strokeColor: 'hsl(265, 80%, 65%)',
        dotColor: 'hsl(265, 80%, 72%)',
        labels: rtLabels,
        unit: 'ms avg response'
      });
    } else {
      if (avgRtEl) avgRtEl.textContent = '--';
      if (fastestRtEl) fastestRtEl.textContent = '--';
      if (slowestRtEl) slowestRtEl.textContent = '--';
      if (rtEmptyMsg) rtEmptyMsg.style.display = 'block';
      if (rtTrendContainer) rtTrendContainer.style.display = 'none';
    }

    // NEW PANEL 6: Study Time Estimation
    const studyTotalTimeEl = document.getElementById('study-total-time');
    const studyAvgSessionEl = document.getElementById('study-avg-session');
    const studyTodayTimeEl = document.getElementById('study-today-time');

    const formatStudyTime = (ms) => {
      if (!ms || isNaN(ms)) return '0s';
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m`;
    };

    const formatSessionMinutes = (ms) => {
      if (!ms || isNaN(ms)) return '--';
      const mins = ms / 1000 / 60;
      if (mins < 1) return `${Math.round(ms / 1000)}s`;
      return `${mins.toFixed(1)}m`;
    };

    const sessions = await getSessions();
    if (sessions.length > 0) {
      const totalSessionTimeMs = sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
      const avgSessionTimeMs = totalSessionTimeMs / sessions.length;
      
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const todaySessionTimeMs = sessions
        .filter(s => s.startTime >= startOfToday)
        .reduce((sum, s) => sum + (s.endTime - s.startTime), 0);

      if (studyTotalTimeEl) studyTotalTimeEl.textContent = formatStudyTime(totalSessionTimeMs);
      if (studyAvgSessionEl) {
        studyAvgSessionEl.textContent = formatSessionMinutes(avgSessionTimeMs);
        const label = studyAvgSessionEl.nextElementSibling;
        if (label) label.textContent = 'Avg Session';
      }
      if (studyTodayTimeEl) studyTodayTimeEl.textContent = formatStudyTime(todaySessionTimeMs);
    } else {
      if (studyTotalTimeEl) studyTotalTimeEl.textContent = formatStudyTime(globalRtSum);
      if (studyAvgSessionEl) {
        studyAvgSessionEl.textContent = globalRtCount > 0 ? formatRt(globalRtSum / globalRtCount) : '--';
        const label = studyAvgSessionEl.nextElementSibling;
        if (label) label.textContent = 'Avg per Review';
      }
      if (studyTodayTimeEl) studyTodayTimeEl.textContent = formatStudyTime(todayStudyTimeMs);
    }

    // NEW PANEL 7: Sandbox Activity Stats
    const sandboxTotalChecksEl = document.getElementById('sandbox-total-checks');
    const sandboxCorrectRateEl = document.getElementById('sandbox-correct-rate');
    const sandboxTodayChecksEl = document.getElementById('sandbox-today-checks');
    const sandboxEmptyMsg = document.getElementById('sandbox-empty-msg');
    const sandboxActivityChart = document.getElementById('sandbox-activity-chart');

    if (globalSandboxChecks > 0) {
      if (sandboxTotalChecksEl) sandboxTotalChecksEl.textContent = globalSandboxChecks;
      if (sandboxCorrectRateEl) {
        const rate = Math.round((globalSandboxCorrect / globalSandboxChecks) * 100);
        sandboxCorrectRateEl.textContent = `${rate}%`;
      }
      if (sandboxTodayChecksEl) sandboxTodayChecksEl.textContent = globalSandboxToday;
      if (sandboxEmptyMsg) sandboxEmptyMsg.style.display = 'none';
      if (sandboxActivityChart) sandboxActivityChart.style.display = 'flex';

      const sandboxPoints = chartBuckets.map(b => b.sandboxChecks);
      const sandboxLabels = chartBuckets.map(b => b.fullDateLabel);
      drawSparkline('sandbox-activity-chart', sandboxPoints, 320, 65, {
        strokeColor: 'hsl(38, 92%, 50%)',
        dotColor: 'hsl(38, 92%, 72%)',
        labels: sandboxLabels,
        unit: ' checks'
      });
    } else {
      if (sandboxTotalChecksEl) sandboxTotalChecksEl.textContent = '0';
      if (sandboxCorrectRateEl) sandboxCorrectRateEl.textContent = '--';
      if (sandboxTodayChecksEl) sandboxTodayChecksEl.textContent = '0';
      if (sandboxEmptyMsg) sandboxEmptyMsg.style.display = 'block';
      if (sandboxActivityChart) sandboxActivityChart.style.display = 'none';
    }

    // 5. Render Hardest Words (Leech List)
    const leechesList = document.getElementById('stats-leeches-list');
    const leechesEmpty = document.getElementById('stats-leeches-empty');

    if (leechesList) {
      leechesList.innerHTML = '';
      
      // Get leeches display limit settings from memory to prevent async race conditions
      let limit = 10;
      if (currentLeechesLimit === 'custom') {
        limit = currentLeechesCustomVal;
      } else if (currentLeechesLimit === 'all') {
        limit = words.length;
      } else {
        limit = parseInt(currentLeechesLimit, 10) || 10;
      }
      
      // Filter words that have misspelled logs and are not mastered, keeping only unique words
      const uniqueLeechesMap = new Map();
      words
        .filter(w => !w.mastered && Array.isArray(w.misspellings) && w.misspellings.length > 0)
        .forEach(w => {
          const key = w.word.toLowerCase();
          if (!uniqueLeechesMap.has(key) || uniqueLeechesMap.get(key).misspellings.length < w.misspellings.length) {
            uniqueLeechesMap.set(key, w);
          }
        });

      const allLeeches = Array.from(uniqueLeechesMap.values())
        // Sort descending by misspelling count
        .sort((a, b) => b.misspellings.length - a.misspellings.length);

      const leeches = allLeeches.slice(0, limit);

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
