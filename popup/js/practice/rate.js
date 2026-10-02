import { atomicUpdate, getNextReviewDate } from '../../../shared/storage.js';
import { peekCard, advanceDeck, requeueCard, getCardShownAt, getOnDeckUpdated, getIsSubmitting, setIsSubmitting, markReviewedWord, getPracticeMode, trackReview, getLastSpellingResult } from './state.js';
import { showPracticeCard } from './card.js';
import { trackSession } from './session.js';

function reviewWordInBackground(wordId, q, typedWrongWord = null, responseTimeMs = null, mode = 'spelling') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'reviewWord',
      wordId,
      q,
      typedWrongWord,
      responseTimeMs,
      mode
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.success) {
        resolve(response.card);
      } else {
        reject(new Error(response?.error || 'Failed to review word'));
      }
    });
  });
}

export async function submitRating(score) {
  if (getIsSubmitting()) return;
  if (!document.getElementById('popup-deck-card').classList.contains('flipped')) return;
  const card = peekCard();
  if (!card) return;
  setIsSubmitting(true);
  try {
    const mode = getPracticeMode();
    const cardShownAt = getCardShownAt();
    const responseTime = cardShownAt > 0 ? Date.now() - cardShownAt : null;
    let updatedCard;
    if (mode === 'recall') {
      updatedCard = await reviewWordInBackground(card.id, score, null, responseTime, 'recall');
      trackReview(card.word, score >= 3, responseTime || 0);
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = getLastSpellingResult();
      updatedCard = await reviewWordInBackground(card.id, score, isOk ? null : typed, responseTime, 'spelling');
      trackReview(card.word, isOk, responseTime || 0);
    }
    await trackSession(mode === 'recall' ? score >= 3 : getLastSpellingResult());
    if (score >= 3) {
      markReviewedWord(card.id, mode);
    }
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      advanceDeck();
      if (updatedCard && score < 3) {
        requeueCard(updatedCard);
      }
      getOnDeckUpdated()?.();
      showPracticeCard();
      setIsSubmitting(false);
    }, 200);
  } catch (err) {
    console.error(err);
    const error = document.getElementById('practice-save-error');
    error.textContent = `Your review could not be saved. Please try the rating again. ${err.message}`;
    error.classList.remove('hidden');
    setIsSubmitting(false);
  }
}

export async function submitMasteredRating(card) {
  if (getIsSubmitting()) return;
  setIsSubmitting(true);
  try {
    const mode = getPracticeMode();
    const cardShownAt = getCardShownAt();
    const responseTime = cardShownAt > 0 ? Date.now() - cardShownAt : null;
    
    if (mode === 'recall') {
      await reviewWordInBackground(card.id, 5, null, responseTime, 'recall');
      trackReview(card.word, true, responseTime || 0);
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = getLastSpellingResult();
      await reviewWordInBackground(card.id, 5, isOk ? null : typed, responseTime, 'spelling');
      trackReview(card.word, isOk, responseTime || 0);
    }
    await trackSession(mode === 'recall' || getLastSpellingResult());
    markReviewedWord(card.id, mode);

    await atomicUpdate(async (list) => {
      const wordObj = list.find(w => w.id === card.id);
      if (wordObj) {
        wordObj.mastered = true;
        wordObj.masteredAt = Date.now();
        wordObj.rep = 0;
        wordObj.interval = 30;
        wordObj.nextDate = getNextReviewDate(30);
        wordObj.meaningRep = 0;
        wordObj.meaningInterval = 30;
        wordObj.meaningNextDate = getNextReviewDate(30);
      }
    });
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      advanceDeck();
      getOnDeckUpdated()?.();
      showPracticeCard();
      setIsSubmitting(false);
    }, 200);
  } catch (err) {
    console.error(err);
    const error = document.getElementById('practice-save-error');
    error.textContent = `Could not mark this word as mastered. Please try again. ${err.message}`;
    error.classList.remove('hidden');
    setIsSubmitting(false);
  }
}
