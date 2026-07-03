const dueCards = [];
let cardShownAt = 0;
let onDeckUpdatedCallback = null;
let isSubmitting = false;
const reviewedWordIds = new Set();
let reviewedWordDate = getLocalDateKey();
let practiceMode = 'spelling'; // 'spelling', 'recall', or 'syntax'

// AI session summary tracking
let sessionStats = { totalReviewed: 0, correctCount: 0, incorrectCount: 0, hardestWords: [], totalTimeMs: 0 };

export function getPracticeMode() { return practiceMode; }
export function setPracticeMode(val) { practiceMode = val; }

export function getDueCards() { return dueCards; }
export function setDueCards(val) {
  dueCards.length = 0;
  dueCards.push(...val);
}
export function getCardShownAt() { return cardShownAt; }
export function setCardShownAt(val) { cardShownAt = val; }
export function getOnDeckUpdated() { return onDeckUpdatedCallback; }
export function setOnDeckUpdated(val) { onDeckUpdatedCallback = val; }
export function getIsSubmitting() { return isSubmitting; }
export function setIsSubmitting(val) { isSubmitting = val; }
export function getReviewedWordIds() { return reviewedWordIds; }
export function getReviewedWordKey(wordId, mode = practiceMode) {
  return `${mode}:${wordId}`;
}
export function refreshReviewedWordDay(date = new Date()) {
  const currentDate = getLocalDateKey(date);
  if (currentDate === reviewedWordDate) return false;
  reviewedWordIds.clear();
  reviewedWordDate = currentDate;
  return true;
}
export function hasReviewedWord(wordId, mode = practiceMode) {
  refreshReviewedWordDay();
  return reviewedWordIds.has(getReviewedWordKey(wordId, mode));
}
export function markReviewedWord(wordId, mode = practiceMode) {
  refreshReviewedWordDay();
  reviewedWordIds.add(getReviewedWordKey(wordId, mode));
}
export function clearReviewedWords() {
  reviewedWordIds.clear();
  reviewedWordDate = getLocalDateKey();
}

export function getSessionStats() { return sessionStats; }
export function resetSessionStats() {
  sessionStats = { totalReviewed: 0, correctCount: 0, incorrectCount: 0, hardestWords: [], totalTimeMs: 0 };
}
export function trackReview(word, isCorrect, timeMs) {
  sessionStats.totalReviewed++;
  if (isCorrect) sessionStats.correctCount++;
  else {
    sessionStats.incorrectCount++;
    if (word && !sessionStats.hardestWords.includes(word)) sessionStats.hardestWords.push(word);
  }
  if (timeMs > 0) sessionStats.totalTimeMs += timeMs;
}

function getLocalDateKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
