import { atomicUpdate, getNextReviewDate } from '../../../shared/storage.js';
import { getDueCards, getCardShownAt, getOnDeckUpdated, getIsSubmitting, setIsSubmitting, markReviewedWord, getPracticeMode, trackReview } from './state.js';
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
  const dueCards = getDueCards();
  const card = dueCards[0];
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
    } else if (mode === 'syntax') {
      updatedCard = await reviewWordInBackground(card.id, score, null, responseTime, 'syntax');
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = typed.toLowerCase() === card.word.toLowerCase();
      updatedCard = await reviewWordInBackground(card.id, score, isOk ? null : typed, responseTime, 'spelling');
    }
    await trackSession(score);
    if (score >= 3) {
      markReviewedWord(card.id, mode);
    }
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      dueCards.shift();
      if (updatedCard && score < 3) {
        dueCards.push(updatedCard);
      }
      getOnDeckUpdated()?.();
      showPracticeCard();
      setIsSubmitting(false);
    }, 200);
  } catch (err) {
    console.error(err);
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
    } else if (mode === 'syntax') {
      await reviewWordInBackground(card.id, 5, null, responseTime, 'syntax');
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = typed.toLowerCase() === card.word.toLowerCase();
      await reviewWordInBackground(card.id, 5, isOk ? null : typed, responseTime, 'spelling');
    }
    await trackSession(5);
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
      getDueCards().shift();
      getOnDeckUpdated()?.();
      showPracticeCard();
      setIsSubmitting(false);
    }, 200);
  } catch (err) {
    console.error(err);
    setIsSubmitting(false);
  }
}
