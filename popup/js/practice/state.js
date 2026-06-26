let dueCards = [];
let cardShownAt = 0;
let onDeckUpdatedCallback = null;

export function getDueCards() { return dueCards; }
export function setDueCards(val) { dueCards = val; }
export function getCardShownAt() { return cardShownAt; }
export function setCardShownAt(val) { cardShownAt = val; }
export function getOnDeckUpdated() { return onDeckUpdatedCallback; }
export function setOnDeckUpdated(val) { onDeckUpdatedCallback = val; }
