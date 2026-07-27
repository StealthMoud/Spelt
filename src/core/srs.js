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

export function calcSM2(q, prevRep, prevInt, prevEF, multiplier = 1.0, isCorrect = true, _errorWeight = 1.0) {
  let rep = typeof prevRep === 'number' && !isNaN(prevRep) ? prevRep : 0;
  let interval;
  let ef = typeof prevEF === 'number' && !isNaN(prevEF) ? prevEF : 2.5;

  if (q < 3) {
    rep = 0;
    interval = 1;
  } else {
    if (prevInt <= 1) {
      if (q === 3) interval = 2;
      else if (q === 4) interval = 4;
      else interval = 7;
    } else {
      if (q === 3) {
        interval = Math.max(1, Math.round(prevInt * 1.2));
      } else if (q === 4) {
        interval = Math.max(prevInt + 1, Math.round(prevInt * ef));
      } else {
        interval = Math.max(prevInt + 1, Math.round(prevInt * ef * 1.3));
      }
    }

    if (!isCorrect) {
      const lapseMax = q === 3 ? 1 : q === 4 ? 2 : 3;
      interval = Math.min(interval, lapseMax);
    }

    rep += 1;
  }

  interval = Math.max(1, Math.round(interval * multiplier));

  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (!isCorrect) ef -= 0.15;
  if (ef < 1.3) ef = 1.3;

  const nextDate = q < 3
    ? Date.now()
    : getNextReviewDate(interval);

  return { rep, interval, ef, nextDate };
}

export function computeErrorWeight(totalErrors = 0, correctStreak = 0) {
  if (totalErrors <= 0) return 1.0;
  const rawPenalty = totalErrors * 0.25;
  const recovery = correctStreak * 0.15;
  return Math.max(0.2, 1.0 / (1 + rawPenalty - Math.min(recovery, rawPenalty * 0.8)));
}
