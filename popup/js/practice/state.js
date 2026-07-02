const dueCards = [];
let cardShownAt = 0;
let onDeckUpdatedCallback = null;
let isSubmitting = false;
const reviewedWordIds = new Set();
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
