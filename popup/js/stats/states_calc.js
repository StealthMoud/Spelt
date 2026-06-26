export function calculateCardStates(words) {
  let newCount = 0, learningCount = 0, matureCount = 0, masteredCount = 0;
  
  words.forEach(w => {
    if (w.mastered) masteredCount++;
    else if (w.rep === 0) newCount++;
    else if (w.interval < 21) learningCount++;
    else matureCount++;
  });

  const totalCards = words.length || 1;
  return {
    newCount, learningCount, matureCount, masteredCount,
    pctNew: (newCount / totalCards) * 100,
    pctLearning: (learningCount / totalCards) * 100,
    pctMature: (matureCount / totalCards) * 100,
    pctMastered: (masteredCount / totalCards) * 100
  };
}

export function calculateForecast(words) {
  let dueToday = 0, dueTomorrow = 0, dueWeek = 0, dueMonth = 0;
  const now = Date.now(), oneDay = 24 * 60 * 60 * 1000;

  words.forEach(w => {
    if (!w.mastered) {
      const diff = w.nextDate - now;
      if (diff <= 0) dueToday++;
      else if (diff <= oneDay) dueTomorrow++;
      else if (diff <= 7 * oneDay) dueWeek++;
      else if (diff <= 30 * oneDay) dueMonth++;
    }
  });

  return { dueToday, dueTomorrow, dueWeek, dueMonth };
}
