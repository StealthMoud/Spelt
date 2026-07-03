export function getLocalMidnight(time = Date.now()) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getNextReviewDate(intervalDays, fromTime = Date.now()) {
  const days = Math.max(1, Math.round(Number(intervalDays) || 1));
  const dueDate = new Date(getLocalMidnight(fromTime));
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate.getTime();
}

// Compute SM-2 spaced repetition values
// quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
// multiplier scales the computed interval (0.5 = faster, 1.5 = slower)
// errorWeight: adaptive multiplier based on accumulated error history (0.0–1.0)
export function calcSM2(q, prevRep, prevInt, prevEF, multiplier = 1.0, isCorrect = true, errorWeight = 1.0) {
  let rep = typeof prevRep === 'number' && !isNaN(prevRep) ? prevRep : 0;
  let interval = typeof prevInt === 'number' && !isNaN(prevInt) ? prevInt : 0;
  let ef = typeof prevEF === 'number' && !isNaN(prevEF) ? prevEF : 2.5;

  if (q < 3) {
    // AGAIN: full reset — card goes back to learning
    rep = 0;
    interval = 1;
  } else {
    if (prevInt <= 1) {
      // GRADUATION: new, lapsed, or reset cards use fixed steps
      if (q === 3) interval = 2;       // Hard — see again in 2 days
      else if (q === 4) interval = 4;  // Good — check in 4 days
      else interval = 7;               // Easy — confident, 1 week
    } else {
      // STANDARD: multiplicative intervals
      // Hard uses a fixed modest multiplier — CAN produce shorter intervals (that's the point)
      // Good/Easy use EF-based growth and must always progress forward
      if (q === 3) {
        interval = Math.max(1, Math.round(prevInt * 1.2));
      } else if (q === 4) {
        interval = Math.max(prevInt + 1, Math.round(prevInt * ef));
      } else {
        interval = Math.max(prevInt + 1, Math.round(prevInt * ef * 1.3));
      }
    }

    // LAPSE: incorrect spelling caps the interval — you don't know it
    if (!isCorrect) {
      const lapseMax = q === 3 ? 1 : q === 4 ? 2 : 3;
      interval = Math.min(interval, lapseMax);
    }

    rep += 1;
  }

  // Apply spacing multiplier from user settings
  interval = Math.max(1, Math.round(interval * multiplier));

  // Adjust Ease Factor (EF) — penalize harder on misspellings
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (!isCorrect) ef -= 0.15;
  if (ef < 1.3) ef = 1.3;

  // "Again" cards stay due immediately,
  // successful reviews get pushed forward by the computed interval
  const nextDate = q < 3
    ? Date.now()
    : getNextReviewDate(interval);

  return { rep, interval, ef, nextDate };
}

// Compute the error-weight multiplier from a word's difficulty history.
// totalErrors: lifetime count of all misspellings (never resets)
// correctStreak: consecutive correct practice reviews
// Returns a value between ~0.2 (very problematic word) and 1.0 (no penalty)
// Formula: each error contributes 0.25 penalty, offset by correct streaks
export function computeErrorWeight(totalErrors = 0, correctStreak = 0) {
  if (totalErrors <= 0) return 1.0;
  const rawPenalty = totalErrors * 0.25;
  const recovery = correctStreak * 0.15;
  return Math.max(0.2, 1.0 / (1 + rawPenalty - Math.min(recovery, rawPenalty * 0.8)));
}
