import { getWords, saveWords } from '../../../shared/storage.js';
import { getDueCards, getCardShownAt, getOnDeckUpdated, getIsSubmitting, setIsSubmitting, getReviewedWordIds, getPracticeMode } from './state.js';
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
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = typed.toLowerCase() === card.word.toLowerCase();
      updatedCard = await reviewWordInBackground(card.id, score, isOk ? null : typed, responseTime, 'spelling');
    }
    await trackSession(score);
    if (score >= 3) {
      getReviewedWordIds().add(card.id);
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
    } else {
      const typed = document.getElementById('spelling-input').value.trim();
      const isOk = typed.toLowerCase() === card.word.toLowerCase();
      await reviewWordInBackground(card.id, 5, isOk ? null : typed, responseTime, 'spelling');
    }
    await trackSession(5);
    getReviewedWordIds().add(card.id);

    const list = await getWords();
    const wordObj = list.find(w => w.id === card.id);
    if (wordObj) {
      wordObj.mastered = true;
      wordObj.masteredAt = Date.now();
      wordObj.rep = 0;
      wordObj.interval = 30;
      wordObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      wordObj.meaningRep = 0;
      wordObj.meaningInterval = 30;
      wordObj.meaningNextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await saveWords(list);
    }
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
