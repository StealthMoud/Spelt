import { isDueInMode } from './selectors.js';

export const DAILY_GOALS = [5, 10, 20];
export const normalizeGoal = value => DAILY_GOALS.includes(Number(value)) ? Number(value) : 10;

export function localDay(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previousDay(value = Date.now()) {
  const date = new Date(value);
  date.setDate(date.getDate() - 1);
  return localDay(date);
}

/** Derive the dashboard from saved reviews, never from word additions or demo data. */
export function learningSummary(words = [], { goal = 10, streak = {}, now = Date.now() } = {}) {
  const today = localDay(now);
  const reviewsByDay = {};
  let correctToday = 0;
  for (const word of words) {
    for (const review of word.history || []) {
      if (!Number.isFinite(review.date) || review.date > now) continue;
      const day = localDay(review.date);
      reviewsByDay[day] = (reviewsByDay[day] || 0) + 1;
      if (day === today && (typeof review.correct === 'boolean' ? review.correct : review.q >= 3)) correctToday++;
    }
  }
  const spelling = words.filter(word => isDueInMode(word, 'spelling', now)).length;
  const recall = words.filter(word => isDueInMode(word, 'recall', now)).length;
  const due = words.filter(word => isDueInMode(word, 'spelling', now) || isDueInMode(word, 'recall', now)).length;
  const reviewed = reviewsByDay[today] || 0;
  const target = normalizeGoal(goal);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + index);
    return { date: localDay(date), label: date.toLocaleDateString('en', { weekday: 'short' }), count: reviewsByDay[localDay(date)] || 0 };
  });
  const nextDates = words.flatMap(word => {
    if (word.mastered) return [];
    const type = word.practiceType || 'both';
    return [type !== 'recall' ? word.nextDate : null, type !== 'spelling' ? word.meaningNextDate : null]
      .filter(date => Number.isFinite(date) && date > now);
  });
  return {
    total: words.length, mastered: words.filter(word => word.mastered).length,
    spelling, recall, due, reviewed, goal: target, correctToday,
    progress: Math.min(100, Math.round(reviewed / target * 100)),
    streak: [today, previousDay(now)].includes(streak.lastDate) ? Math.max(0, Number(streak.current) || 0) : 0,
    week, nextReview: nextDates.length ? Math.min(...nextDates) : null
  };
}

/** Stable oldest-due ordering, with troublesome words first when dates tie. */
export function prioritizeDueCards(cards, mode = 'spelling') {
  const dateKey = mode === 'recall' ? 'meaningNextDate' : 'nextDate';
  return [...cards].sort((a, b) => (a[dateKey] || 0) - (b[dateKey] || 0)
    || (b.totalErrors || 0) - (a.totalErrors || 0)
    || (a.createdAt || 0) - (b.createdAt || 0));
}
