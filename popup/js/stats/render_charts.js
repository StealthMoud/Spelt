export function renderReviewChart(chartBuckets, barWidth) {
  const chartContainer = document.getElementById('stats-chart-container');
  if (!chartContainer) return;
  chartContainer.innerHTML = '';
  
  const maxBucketReviews = Math.max(...chartBuckets.map(b => b.total), 1);
  chartContainer.setAttribute('role', 'img');
  chartContainer.setAttribute('aria-label', `Review activity chart over past ${chartBuckets.length} ${chartBuckets[0]?.type === 'day' ? 'days' : 'weeks'}, max ${maxBucketReviews} reviews`);

  if (chartBuckets.every(b => b.total === 0)) {
    chartContainer.innerHTML = `<div class="chart-empty-state">No review activity recorded in this period.</div>`;
    return;
  }

  chartBuckets.forEach(bucket => {
    const heightPercent = Math.max(0, (bucket.total / maxBucketReviews) * 100);
    const correctPct = bucket.total > 0 ? (bucket.correct / bucket.total) * 100 : 0;
    const incorrectPct = bucket.total > 0 ? (bucket.incorrect / bucket.total) * 100 : 0;

    const col = document.createElement('div');
    col.className = 'bar-column';
    col.setAttribute('title', `${bucket.fullDateLabel}: ${bucket.total} reviews (${bucket.correct} correct, ${bucket.incorrect} incorrect)`);
    col.innerHTML = `
      <div class="bar-hover-val">${bucket.total} ${bucket.total === 1 ? 'review' : 'reviews'}</div>
      <div class="bar-track">
        ${bucket.total > 0 ? `
          <div class="bar-fill">
            <div class="bar-segment correct" title="${bucket.correct} Correct ${bucket.type === 'day' ? 'on' : 'during'} ${bucket.fullDateLabel}"></div>
            <div class="bar-segment incorrect" title="${bucket.incorrect} Incorrect ${bucket.type === 'day' ? 'on' : 'during'} ${bucket.fullDateLabel}"></div>
          </div>
        ` : `<div class="bar-fill empty"></div>`}
      </div>
      <span class="bar-label">${bucket.label}</span>
    `;

    const track = col.querySelector('.bar-track');
    if (track) track.style.width = `${barWidth}px`;

    if (bucket.total > 0) {
      const fill = col.querySelector('.bar-fill');
      if (fill) fill.style.height = `${heightPercent}%`;
      const correct = col.querySelector('.bar-segment.correct');
      if (correct) correct.style.height = `${correctPct}%`;
      const incorrect = col.querySelector('.bar-segment.incorrect');
      if (incorrect) incorrect.style.height = `${incorrectPct}%`;
    } else {
      const emptyFill = col.querySelector('.bar-fill.empty');
      if (emptyFill) emptyFill.style.height = '4px';
    }

    chartContainer.appendChild(col);
  });
}

export function renderButtonDistribution(buttonCounts) {
  const btnContainer = document.getElementById('button-dist-list');
  if (!btnContainer) return;
  btnContainer.innerHTML = '';
  const totalAnswers = Object.values(buttonCounts).reduce((a, b) => a + b, 0) || 1;
  
  const buttons = [
    { name: 'Again', count: buttonCounts.again, cssClass: 'again' },
    { name: 'Hard', count: buttonCounts.hard, cssClass: 'hard' },
    { name: 'Good', count: buttonCounts.good, cssClass: 'good' },
    { name: 'Easy', count: buttonCounts.easy, cssClass: 'easy' }
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
        <div class="btn-dist-progress-fill ${btn.cssClass}"></div>
      </div>
    `;

    const fill = row.querySelector('.btn-dist-progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    btnContainer.appendChild(row);
  });
}

export function renderCEFRDistribution(words) {
  const cefrCounts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, Unknown: 0 };
  words.forEach(w => {
    const lvl = (w.level || '').toUpperCase().trim();
    if (cefrCounts[lvl] !== undefined) cefrCounts[lvl]++;
    else cefrCounts.Unknown++;
  });

  const cefrContainer = document.getElementById('cefr-dist-container');
  if (!cefrContainer) return;
  cefrContainer.innerHTML = '';
  const totalWithLevel = Object.values(cefrCounts).reduce((a, b) => a + b, 0) || 1;
  const levelsToShow = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (cefrCounts.Unknown > 0) levelsToShow.push('Unknown');

  levelsToShow.forEach(lvl => {
    const count = cefrCounts[lvl], pct = Math.round((count / totalWithLevel) * 100);
    const row = document.createElement('div');
    row.className = 'cefr-row';
    row.innerHTML = `
      <span class="cefr-label-badge">${lvl === 'Unknown' ? '?' : lvl}</span>
      <div class="cefr-bar-wrapper"><div class="cefr-bar-fill"></div></div>
      <span class="cefr-count-label">${count} (${pct}%)</span>
    `;

    const barFill = row.querySelector('.cefr-bar-fill');
    if (barFill) barFill.style.width = `${pct}%`;

    cefrContainer.appendChild(row);
  });
}
