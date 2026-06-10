import { getWords } from '../../shared/storage.js';

const isExt = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

async function getStoredData(key) {
  if (isExt) {
    const res = await chrome.storage.local.get(key);
    return res[key];
  }
  return null;
}

export async function reloadAnalytics() {
  const words = await getWords();
  const streak = await getStoredData('spelt_streak') || { current: 0 };
  const activity = await getStoredData('spelt_activity') || {};

  updateStatsCards(words, streak.current);
  updateDistBars(words);
  updateActivityHeatmap(activity);
}

function updateStatsCards(words, streakCount) {
  // Streak display
  document.getElementById('stats-streak').textContent = `${streakCount} Day${streakCount === 1 ? '' : 's'}`;

  // Mastered cards (EF >= 2.8)
  const masteredCount = words.filter(w => w.rep > 0 && w.ef >= 2.8).length;
  document.getElementById('stats-mastered').textContent = masteredCount;

  // Retention calculation: (reviews >= 3 / total reviews) * 100
  let totalReviews = 0;
  let correctReviews = 0;
  
  words.forEach(w => {
    if (w.history && Array.isArray(w.history)) {
      w.history.forEach(h => {
        totalReviews += 1;
        if (h.q >= 3) correctReviews += 1;
      });
    }
  });

  const rate = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 100;
  document.getElementById('stats-retention').textContent = `${rate}%`;
}

function updateDistBars(words) {
  const total = words.length || 1;
  const countNew = words.filter(w => w.rep === 0).length;
  const countMastered = words.filter(w => w.rep > 0 && w.ef >= 2.8).length;
  const countLearning = words.length - countNew - countMastered;

  // Set counts
  document.getElementById('count-new').textContent = countNew;
  document.getElementById('count-learning').textContent = countLearning;
  document.getElementById('count-mastered').textContent = countMastered;

  // Set bar widths
  document.getElementById('bar-new').style.width = `${(countNew / total) * 100}%`;
  document.getElementById('bar-learning').style.width = `${(countLearning / total) * 100}%`;
  document.getElementById('bar-mastered').style.width = `${(countMastered / total) * 100}%`;
}

function updateActivityHeatmap(activity) {
  const grid = document.getElementById('activity-heatmap');
  if (!grid) return;
  grid.innerHTML = '';

  // Render last 28 days (4 weeks) chronological
  const dates = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().split('T')[0]);
  }

  dates.forEach(dateStr => {
    const count = activity[dateStr] || 0;
    const dayBlock = document.createElement('div');
    
    // Determine color value bucket
    let valClass = 'val-0';
    if (count > 0 && count <= 2) valClass = 'val-1';
    else if (count > 2 && count <= 5) valClass = 'val-2';
    else if (count > 5 && count <= 9) valClass = 'val-3';
    else if (count >= 10) valClass = 'val-4';

    dayBlock.className = `heatmap-day ${valClass}`;
    
    // Formatting mouse-over label
    const niceDate = new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    dayBlock.title = `${niceDate}: ${count} spelling review${count === 1 ? '' : 's'}`;

    grid.appendChild(dayBlock);
  });
}
