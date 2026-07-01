import { getWords, saveWords, censorWordInExample, getFallbackExample, fetchCambridgePronunciation } from '../../../shared/storage.js';
import { getDueCards, setDueCards, getOnDeckUpdated, setCardShownAt, getIsSubmitting, getReviewedWordIds, getPracticeMode } from './state.js';
import { renderAudioButtons, formatLevelDisplay } from './helpers.js';

let currentSyntaxCard = null;
let scrambledPool = [];
let orderedBlocks = [];

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderBlocksUI() {
  if (!currentSyntaxCard) return;
  const scrambledContainer = document.getElementById('syntax-blocks-scrambled');
  const orderedContainer = document.getElementById('syntax-blocks-ordered');
  
  if (!scrambledContainer || !orderedContainer) return;
  scrambledContainer.innerHTML = '';
  orderedContainer.innerHTML = '';

  scrambledPool.forEach((blockText, idx) => {
    const btn = document.createElement('button');
    btn.className = 'practice-mode-pill';
    btn.style.cssText = 'padding: 6px 12px; font-size: 0.7rem; background: hsla(155, 10%, 15%, 0.4); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-muted); cursor: pointer; text-align: left; transition: all 0.2s ease; font-weight: 500;';
    btn.textContent = blockText;
    btn.addEventListener('click', () => {
      scrambledPool.splice(idx, 1);
      orderedBlocks.push(blockText);
      renderBlocksUI();
    });
    scrambledContainer.appendChild(btn);
  });

  orderedBlocks.forEach((blockText, idx) => {
    const el = document.createElement('div');
    el.style.cssText = 'padding: 6px 10px; font-size: 0.72rem; background: rgba(24, 144, 255, 0.08); border: 1px solid rgba(24, 144, 255, 0.25); border-radius: var(--radius-sm); color: var(--primary-light); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 500;';
    el.innerHTML = `<span style="word-break: break-word; flex: 1;">${blockText}</span><span style="font-size: 0.65rem; color: var(--text-muted); margin-left: 6px; flex-shrink: 0;">✕</span>`;
    el.addEventListener('click', () => {
      orderedBlocks.splice(idx, 1);
      scrambledPool.push(blockText);
      renderBlocksUI();
    });
    orderedContainer.appendChild(el);
  });

  const isFull = orderedBlocks.length === (currentSyntaxCard.blocks || []).length;
  const orderedBox = document.getElementById('syntax-blocks-ordered');
  const jointsInput = document.getElementById('syntax-joints-input');
  const checkBtn = document.getElementById('check-syntax-btn');
  const layoutContainer = document.getElementById('syntax-sentence-layout-container');

  if (isFull) {
    const isCorrect = orderedBlocks.every((val, index) => val === currentSyntaxCard.blocks[index]);
    if (isCorrect) {
      orderedBox.style.borderColor = 'var(--success)';
      jointsInput.removeAttribute('disabled');
      checkBtn.removeAttribute('disabled');
      layoutContainer.style.display = 'block';

      // Blank out joints
      let sentenceWithBlanks = currentSyntaxCard.example || '';
      (currentSyntaxCard.joints || []).forEach(joint => {
        const regex = new RegExp('\\b' + joint.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
        sentenceWithBlanks = sentenceWithBlanks.replace(regex, '[ ______ ]');
      });
      document.getElementById('syntax-sentence-layout').textContent = sentenceWithBlanks;
      setTimeout(() => jointsInput.focus(), 100);
    } else {
      orderedBox.style.borderColor = 'var(--danger)';
      jointsInput.setAttribute('disabled', 'true');
      checkBtn.setAttribute('disabled', 'true');
      layoutContainer.style.display = 'none';
    }
  } else {
    orderedBox.style.borderColor = 'var(--border)';
    jointsInput.setAttribute('disabled', 'true');
    checkBtn.setAttribute('disabled', 'true');
    layoutContainer.style.display = 'none';
  }
}

function renderSyntaxFrontFace(card) {
  currentSyntaxCard = card;
  orderedBlocks = [];
  scrambledPool = shuffleArray(card.blocks || []);
  
  document.getElementById('syntax-front-translation').textContent = card.translation || 'No translation added.';
  document.getElementById('syntax-front-pattern').textContent = card.definition || 'No template description.';
  
  const jointsInput = document.getElementById('syntax-joints-input');
  if (jointsInput) {
    jointsInput.value = '';
    jointsInput.setAttribute('disabled', 'true');
  }
  const checkBtn = document.getElementById('check-syntax-btn');
  if (checkBtn) {
    checkBtn.setAttribute('disabled', 'true');
  }

  renderBlocksUI();
}

export async function loadPracticeDeck() {
  const words = await getWords();
  const reviewedIds = getReviewedWordIds();
  const mode = getPracticeMode();
  
  if (mode === 'syntax') {
    setDueCards(words.filter(w => w.practiceType === 'syntax' && w.nextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  } else if (mode === 'recall') {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'recall') && w.meaningNextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  } else {
    setDueCards(words.filter(w => (w.practiceType === 'both' || w.practiceType === 'spelling') && w.nextDate <= Date.now() && !w.mastered && !reviewedIds.has(w.id)));
  }
  
  getOnDeckUpdated()?.(); showPracticeCard();
}

export function showPracticeCard() {
  const cardEl = document.getElementById('popup-deck-card');
  const emptyEl = document.getElementById('popup-deck-empty-state');
  const spellInput = document.getElementById('spelling-input');
  const dueCards = getDueCards();

  if (dueCards.length === 0) { cardEl.style.display = 'none'; emptyEl.style.display = 'flex'; return; }

  cardEl.style.display = 'flex'; emptyEl.style.display = 'none';
  cardEl.classList.remove('flipped'); spellInput.value = '';
  setCardShownAt(Date.now());

  const card = dueCards[0];
  const mode = getPracticeMode();

  const frontSpellingContent = document.getElementById('front-spelling-content');
  const frontRecallContent = document.getElementById('front-recall-content');
  const frontSyntaxContent = document.getElementById('front-syntax-content');
  
  const frontSpellingWrapper = document.getElementById('front-spelling-wrapper');
  const frontRecallWrapper = document.getElementById('front-recall-wrapper');
  const frontSyntaxWrapper = document.getElementById('front-syntax-wrapper');

  if (mode === 'syntax') {
    if (frontSpellingContent) frontSpellingContent.style.display = 'none';
    if (frontRecallContent) frontRecallContent.style.display = 'none';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'flex';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'none';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'none';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'flex';

    renderSyntaxFrontFace(card);
  } else if (mode === 'recall') {
    if (frontSpellingContent) frontSpellingContent.style.display = 'none';
    if (frontRecallContent) frontRecallContent.style.display = 'flex';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'none';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'none';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'flex';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'none';

    document.getElementById('recall-front-word').textContent = card.word;
    document.getElementById('recall-front-transcription').textContent = card.transcription || '/--/';
    const recallAudio = document.getElementById('recall-front-audio-container');
    if (recallAudio) recallAudio.innerHTML = renderAudioButtons(card.word);
    document.getElementById('recall-front-pos').textContent = card.partOfSpeech || 'unknown';

    const levelContainer = document.getElementById('recall-front-level-container');
    const levelEl = document.getElementById('recall-front-level');
    if (levelContainer && levelEl) {
      let displayLevel = card.level || '';
      levelEl.textContent = displayLevel;
      levelContainer.style.display = displayLevel ? 'inline-block' : 'none';
    }

    // Populate and show example sentence on front for Recall mode context clues
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    const exampleContainer = document.getElementById('recall-front-example-container');
    if (rawExample) {
      document.getElementById('recall-front-example').textContent = rawExample;
      if (exampleContainer) exampleContainer.style.display = 'block';
    } else {
      if (exampleContainer) exampleContainer.style.display = 'none';
    }

    // Set dynamic hint/prompt text
    const hintEl = document.getElementById('recall-front-hint');
    if (hintEl) {
      hintEl.textContent = card.word.trim().includes(' ') 
        ? 'What does this expression mean?' 
        : 'What does this word mean?';
    }
  } else {
    if (frontSpellingContent) frontSpellingContent.style.display = 'flex';
    if (frontRecallContent) frontRecallContent.style.display = 'none';
    if (frontSyntaxContent) frontSyntaxContent.style.display = 'none';
    if (frontSpellingWrapper) frontSpellingWrapper.style.display = 'flex';
    if (frontRecallWrapper) frontRecallWrapper.style.display = 'none';
    if (frontSyntaxWrapper) frontSyntaxWrapper.style.display = 'none';

    document.getElementById('practice-definition').textContent = card.definition || 'No definition added.';
    document.getElementById('practice-transcription').textContent = card.transcription || '/--/';
    document.getElementById('practice-part-of-speech').textContent = card.partOfSpeech || 'unknown';

    const transEl = document.getElementById('practice-translation');
    if (transEl) {
      if (card.translation) {
        transEl.innerHTML = `<span class="translation-blur-text">${card.translation}</span><span class="translation-reveal-hint">Reveal</span>`;
        transEl.className = 'translation-clue-box';
        const newEl = transEl.cloneNode(true);
        transEl.parentNode.replaceChild(newEl, transEl);
        newEl.addEventListener('click', () => newEl.classList.add('revealed'));
      } else {
        transEl.textContent = '--'; transEl.className = '';
      }
    }

    const levelContainer = document.getElementById('practice-level-container');
    const levelEl = document.getElementById('practice-level');
    if (levelContainer && levelEl) {
      let displayLevel = card.level || '';
      let otherLevels = card.otherLevels || [];
      levelEl.innerHTML = displayLevel ? formatLevelDisplay(displayLevel, otherLevels) : '';
      levelContainer.style.display = displayLevel ? 'block' : 'none';
    }

    const exampleContainer = document.getElementById('practice-example-container');
    const exampleTransEl = document.getElementById('practice-example-translation');
    const translateBtn = document.getElementById('practice-translate-btn');
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (rawExample) {
      document.getElementById('practice-example').textContent = censorWordInExample(card.word, rawExample);
      exampleContainer.style.display = 'block';
    } else exampleContainer.style.display = 'none';
    if (exampleTransEl) { exampleTransEl.style.display = 'none'; exampleTransEl.textContent = ''; }
    if (translateBtn) translateBtn.classList.remove('active');

    const audioContainer = document.getElementById('practice-audio-container');
    if (audioContainer) audioContainer.innerHTML = renderAudioButtons(card.word);
  }

  // Handle Cambridge pronunciation auto-fetch if level doesn't exist
  if (card.word && !card.level && card.practiceType !== 'syntax') {
    fetchCambridgePronunciation(card.word).then(async cambridge => {
      if (cambridge.level) {
        card.level = cambridge.level;
        card.otherLevels = (cambridge.allLevels || []).filter(l => l !== cambridge.level);
        
        // Dynamically update UI in place
        if (mode === 'recall') {
          const levelEl = document.getElementById('recall-front-level');
          const levelContainer = document.getElementById('recall-front-level-container');
          if (levelEl && levelContainer) {
            levelEl.textContent = card.level;
            levelContainer.style.display = 'inline-block';
          }
        } else {
          const levelEl = document.getElementById('practice-level');
          const levelContainer = document.getElementById('practice-level-container');
          if (levelEl && levelContainer) {
            levelEl.innerHTML = formatLevelDisplay(card.level, card.otherLevels);
            levelContainer.style.display = 'block';
          }
        }
        
        const all = await getWords(), w = all.find(x => x.id === card.id);
        if (w) { w.level = card.level; w.otherLevels = card.otherLevels; await saveWords(all); }
      }
    }).catch(() => {});
  }
}

export async function syncPracticeDeck() {
  const fresh = await getWords(), now = Date.now(), currentDue = getDueCards();
  const activeCard = currentDue[0], oldActiveId = activeCard?.id;
  const mode = getPracticeMode();
  let due = [];
  if (activeCard) {
    const freshActive = fresh.find(w => w.id === activeCard.id);
    if (freshActive) due.push(freshActive);
  }
  const activeId = activeCard ? activeCard.id : null;
  const restDue = currentDue.slice(1).map(c => fresh.find(w => w.id === c.id) || c).filter(c => {
    const f = fresh.find(w => w.id === c.id);
    if (!f) return false;
    const isDue = f.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? f.practiceType === 'syntax'
      : mode === 'recall'
        ? (f.practiceType === 'both' || f.practiceType === 'recall') && f.meaningNextDate <= now
        : (f.practiceType === 'both' || f.practiceType === 'spelling');
    return !f.mastered && isDue && matchesMode && f.id !== activeId;
  });
  due.push(...restDue);
  const ids = new Set(due.map(c => c.id));
  const reviewedIds = getReviewedWordIds();
  due.push(...fresh.filter(w => {
    const isDue = mode === 'recall' ? w.meaningNextDate <= now : w.nextDate <= now;
    const matchesMode = mode === 'syntax'
      ? w.practiceType === 'syntax'
      : mode === 'recall'
        ? (w.practiceType === 'both' || w.practiceType === 'recall')
        : (w.practiceType === 'both' || w.practiceType === 'spelling');
    return isDue && matchesMode && !w.mastered && !ids.has(w.id) && !reviewedIds.has(w.id);
  }));
  setDueCards(due); getOnDeckUpdated()?.();
  const newActiveId = getDueCards()[0]?.id, isFlipped = document.getElementById('popup-deck-card')?.classList.contains('flipped');
  if (oldActiveId !== newActiveId || (!isFlipped && !getIsSubmitting())) showPracticeCard();
}
