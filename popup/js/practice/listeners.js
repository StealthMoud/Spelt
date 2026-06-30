import { getWords, saveWords, getStored, setStored, fetchTranslation, getFallbackExample } from '../../../shared/storage.js';
import { openModal } from '../vault.js';
import { getDueCards, setPracticeMode } from './state.js';
import { checkSpelling, revealRecall } from './actions.js';
import { submitRating, submitMasteredRating } from './rate.js';
import { loadPracticeDeck } from './card.js';

export function registerPracticeListeners() {
  document.getElementById('check-spelling-btn')?.addEventListener('click', checkSpelling);
  document.getElementById('reveal-recall-btn')?.addEventListener('click', revealRecall);
  
  document.getElementById('spelling-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); checkSpelling(); }
  });

  const initModeToggle = async () => {
    const savedMode = await getStored('spelt_practice_mode') || 'spelling';
    setPracticeMode(savedMode);
    
    const spellingPill = document.getElementById('practice-mode-spelling');
    const recallPill = document.getElementById('practice-mode-recall');
    
    if (spellingPill && recallPill) {
      if (savedMode === 'recall') {
        spellingPill.classList.remove('active');
        recallPill.classList.add('active');
      } else {
        spellingPill.classList.add('active');
        recallPill.classList.remove('active');
      }
      
      const switchMode = async (mode) => {
        setPracticeMode(mode);
        await setStored('spelt_practice_mode', mode);
        if (mode === 'recall') {
          spellingPill.classList.remove('active');
          recallPill.classList.add('active');
        } else {
          spellingPill.classList.add('active');
          recallPill.classList.remove('active');
        }
        await loadPracticeDeck();
      };
      
      spellingPill.addEventListener('click', () => switchMode('spelling'));
      recallPill.addEventListener('click', () => switchMode('recall'));
    }
  };
  
  initModeToggle().catch(err => console.error(err));

  const translateAction = async (btnId, transId, containerId) => {
    const dueCards = getDueCards();
    const card = dueCards[0];
    if (!card) return;
    const transEl = document.getElementById(transId);
    const container = containerId ? document.getElementById(containerId) : null;
    const btn = document.getElementById(btnId);
    if (!transEl || !btn) return;
    
    const displayEl = container || transEl;
    if (displayEl.style.display === 'block') {
      displayEl.style.display = 'none'; btn.classList.remove('active'); return;
    }
    
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (!rawExample) return;
    
    let trans = card.exampleTranslation;
    if (!trans) {
      const targetLang = await getStored('spelt_target_lang');
      if (!targetLang || targetLang === 'none') {
        alert('Please configure a preferred language in Settings first.'); return;
      }
      transEl.textContent = 'Translating...';
      displayEl.style.display = 'block';
      trans = await fetchTranslation(rawExample, targetLang);
      if (trans) {
        card.exampleTranslation = trans;
        const allWords = await getWords();
        const wObj = allWords.find(w => w.id === card.id);
        if (wObj) { wObj.exampleTranslation = trans; await saveWords(allWords); }
      } else {
        transEl.textContent = 'Translation failed'; return;
      }
    }
    transEl.textContent = `"${trans}"`;
    displayEl.style.display = 'block';
    btn.classList.add('active');
  };

  document.getElementById('practice-translate-btn')?.addEventListener('click', () => 
    translateAction('practice-translate-btn', 'practice-example-translation')
  );

  document.getElementById('back-translate-btn')?.addEventListener('click', () => 
    translateAction('back-translate-btn', 'back-example-translation-display', 'back-example-translation-container')
  );

  document.querySelectorAll('.practice-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = getDueCards()[0];
      if (card) openModal(card);
    });
  });

  document.querySelectorAll('#practice-tab .srs-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scoreAttr = btn.getAttribute('data-score');
      const card = getDueCards()[0];
      if (!card) return;
      if (scoreAttr === 'mastered') {
        const modal = document.getElementById('popup-confirm-modal');
        if (modal) {
          document.getElementById('popup-confirm-title').textContent = 'Mark as Mastered?';
          document.getElementById('popup-confirm-msg').textContent = `Are you sure you want to mark "${card.word}" as Mastered?`;
          
          const confirmBtn = document.getElementById('popup-confirm-ok-btn');
          const cancelBtn = document.getElementById('popup-confirm-cancel-btn');
          
          const onConfirm = async () => { modal.style.display = 'none'; cleanup(); await submitMasteredRating(card); };
          const onCancel = () => { modal.style.display = 'none'; cleanup(); };
          const cleanup = () => { confirmBtn.removeEventListener('click', onConfirm); cancelBtn.removeEventListener('click', onCancel); };
          
          confirmBtn.addEventListener('click', onConfirm);
          cancelBtn.addEventListener('click', onCancel);
          modal.style.display = 'flex';
        } else if (confirm(`Mark "${card.word}" as Mastered?`)) {
          await submitMasteredRating(card);
        }
      } else {
        await submitRating(parseInt(scoreAttr, 10));
      }
    });
  });
}
