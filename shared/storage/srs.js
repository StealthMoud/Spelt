// Compute SM-2 spaced repetition values
// quality: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
// multiplier scales the computed interval (0.5 = faster, 1.5 = slower)
// errorWeight: adaptive multiplier based on accumulated error history (0.0–1.0)
export function calcSM2(q, prevRep, prevInt, prevEF, multiplier = 1.0, isCorrect = true, errorWeight = 1.0) {
  let rep = prevRep;
  let interval = prevInt;
  let ef = prevEF;

  if (q < 3) {
    rep = 0;
    interval = 1; // reset
  } else {
    if (rep === 0) {
      if (q === 3) interval = 1;
      else if (q === 4) interval = 6;
      else if (q === 5) interval = 12;
      else interval = 1;
    } else if (rep === 1 && prevInt === 1) {
      if (q === 3) interval = 3;
      else if (q === 4) interval = 6;
      else if (q === 5) interval = 12;
      else interval = 6;
    } else {
      // Scale interval growth based on card rating (prevents flat intervals when user reviews)
      let qualityMultiplier = 1.0;
      if (q === 3) qualityMultiplier = 0.6;      // Hard
      else if (q === 5) qualityMultiplier = 1.3; // Easy

      interval = Math.round(prevInt * ef * qualityMultiplier);

      // Keep progression strictly forward
      if (interval <= prevInt) {
        interval = prevInt + 1;
      }
    }

    // Penalty if spelled incorrectly so they re-test sooner
    if (!isCorrect) {
      interval = Math.round(interval * 0.5);
    }

    rep += 1;
  }

  // Apply spacing multiplier from user settings
  interval = Math.max(1, Math.round(interval * multiplier));

  // Apply error-weight: words with more accumulated errors get shorter intervals.
  // The weight is computed externally from totalErrors and correctStreak.
  // A weight of 1.0 means no change; 0.5 means intervals are halved.
  if (errorWeight < 1.0) {
    interval = Math.max(1, Math.round(interval * errorWeight));
  }

  // Adjust Ease Factor (EF)
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  // "Again" cards stay due immediately,
  // successful reviews get pushed forward by the computed interval
  const nextDate = q < 3
    ? Date.now()
    : Date.now() + interval * 24 * 60 * 60 * 1000;

  return { rep, interval, ef, nextDate };
}

// Compute the error-weight multiplier from a word's difficulty history.
// totalErrors: lifetime count of all misspellings (never resets)
// correctStreak: consecutive correct practice reviews
// Returns a value between ~0.29 (very sticky) and 1.0 (no penalty)
export function computeErrorWeight(totalErrors = 0, correctStreak = 0) {
  if (totalErrors <= 0) return 1.0;
  return 1.0 / (1 + (totalErrors * 0.12) / (1 + correctStreak * 0.4));
}
