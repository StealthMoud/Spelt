import { reviewWord, getWords, saveWords } from '../../../shared/storage.js';
import { getDueCards, getCardShownAt, getOnDeckUpdated } from './state.js';
import { showPracticeCard } from './card.js';
import { trackSession } from './session.js';

export async function submitRating(score) {
  const dueCards = getDueCards();
  const card = dueCards[0];
  if (!card) return;
  try {
    const typed = document.getElementById('spelling-input').value.trim();
    const isOk = typed.toLowerCase() === card.word.toLowerCase();
    const cardShownAt = getCardShownAt();
    const responseTime = cardShownAt > 0 ? Date.now() - cardShownAt : null;
    
    const updatedCard = await reviewWord(card.id, score, isOk ? null : typed, responseTime);
    await trackSession(score);
    
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      dueCards.shift();
      if (updatedCard && score < 3) {
        dueCards.push(updatedCard);
      }
      getOnDeckUpdated()?.();
      showPracticeCard();
    }, 200);
  } catch (err) { console.error(err); }
}

export async function submitMasteredRating(card) {
  try {
    const typed = document.getElementById('spelling-input').value.trim();
    const isOk = typed.toLowerCase() === card.word.toLowerCase();
    const cardShownAt = getCardShownAt();
    const responseTime = cardShownAt > 0 ? Date.now() - cardShownAt : null;
    
    await reviewWord(card.id, 5, isOk ? null : typed, responseTime);
    await trackSession(5);

    const list = await getWords();
    const wordObj = list.find(w => w.id === card.id);
    if (wordObj) {
      wordObj.mastered = true;
      wordObj.masteredAt = Date.now();
      wordObj.rep = 0;
      wordObj.interval = 30;
      wordObj.nextDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await saveWords(list);
    }
    document.getElementById('popup-deck-card').classList.remove('flipped');
    setTimeout(() => {
      getDueCards().shift();
      getOnDeckUpdated()?.();
      showPracticeCard();
    }, 200);
  } catch (err) { console.error(err); }
}
