export function isDueInMode(word, mode, now = Date.now()) {
  if (!word || word.mastered) return false;
  const isSpellingDue = (word.nextDate || 0) <= now;
  const isRecallDue = (word.meaningNextDate || 0) <= now;
  const pType = word.practiceType || 'both';

  if (mode === 'spelling') {
    return isSpellingDue && (pType === 'spelling' || pType === 'both');
  } else if (mode === 'recall') {
    return isRecallDue && (pType === 'recall' || pType === 'both');
  }
  return isSpellingDue || isRecallDue;
}

export function selectDueCards(words, mode, { excludeIds = new Set() } = {}) {
  const now = Date.now();
  const excludeSet = excludeIds instanceof Set ? excludeIds : new Set(Array.isArray(excludeIds) ? excludeIds : []);
  return (words || []).filter(w => {
    if (excludeSet.has(w.id)) return false;
    return isDueInMode(w, mode, now);
  });
}
