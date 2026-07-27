import { areSpellingVariants } from '../../../shared/storage.js';

export function isAnswerCorrect(typed, targetWord) {
  if (!typed || !targetWord) return false;
  const exactMatch = typed.trim().toLowerCase() === targetWord.trim().toLowerCase();
  if (exactMatch) return true;
  return areSpellingVariants(typed.trim(), targetWord.trim());
}
