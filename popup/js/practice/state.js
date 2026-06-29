const dueCards = [];
let cardShownAt = 0;
let onDeckUpdatedCallback = null;
let isSubmitting = false;

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
