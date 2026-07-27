// Re-export shim — the original card.js has been split into:
//   deck.js       — loadPracticeDeck, showPracticeCard, syncPracticeDeck
//   front_face.js — populateFrontFace
//   ai_panels.js  — AI panel setup functions
export { loadPracticeDeck, showPracticeCard, syncPracticeDeck } from './deck.js';
export { populateFrontFace } from './front_face.js';
