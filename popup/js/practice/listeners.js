import { getStored, setStored, fetchTranslation, getFallbackExample, atomicUpdate } from '../../../shared/storage.js';
import { openModal } from '../vault.js';
import { showConfirm } from '../vault/confirm.js';
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
    
    const setPillsActive = (activeMode) => {
      [spellingPill, recallPill].forEach(pill => {
        if (pill) {
          pill.classList.remove('active');
          pill.setAttribute('aria-pressed', 'false');
        }
      });
      const activePill = activeMode === 'recall' ? recallPill : spellingPill;
      activePill?.classList.add('active');
      activePill?.setAttribute('aria-pressed', 'true');
    };
    
    setPillsActive(savedMode);
    
    const switchMode = async (mode) => {
      setPracticeMode(mode);
      await setStored('spelt_practice_mode', mode);
      setPillsActive(mode);
      await loadPracticeDeck();
    };
    
    if (spellingPill) spellingPill.addEventListener('click', () => switchMode('spelling'));
    if (recallPill) recallPill.addEventListener('click', () => switchMode('recall'));
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
    if (!displayEl.classList.contains('hidden')) {
      displayEl.classList.add('hidden'); btn.classList.remove('active'); return;
    }
    
    const rawExample = card.example || getFallbackExample(card.word, card.partOfSpeech);
    if (!rawExample) return;
    
    let trans = card.exampleTranslation;
    if (!trans) {
      const targetLang = await getStored('spelt_target_lang');
      if (!targetLang || targetLang === 'none') {
        showConfirm('Preferred Language Required', 'Please configure a preferred language in Settings first.', null, false); return;
      }
      transEl.textContent = 'Translating...';
      displayEl.classList.remove('hidden');
      trans = await fetchTranslation(rawExample, targetLang);
      if (trans) {
        card.exampleTranslation = trans;
        await atomicUpdate(async (allWords) => {
          const wObj = allWords.find(w => w.id === card.id);
          if (wObj) { wObj.exampleTranslation = trans; }
        });
      } else {
        transEl.textContent = 'Translation failed'; return;
      }
    }
    transEl.textContent = `"${trans}"`;
    displayEl.classList.remove('hidden');
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
        showConfirm('Mark as Mastered?', `Are you sure you want to mark "${card.word}" as Mastered?`, async () => {
          await submitMasteredRating(card);
        });
      } else {
        await submitRating(parseInt(scoreAttr, 10));
      }
    });
  });
}
