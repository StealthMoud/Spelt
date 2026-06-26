import { playSentenceAudio, getStored, fetchTranslation, getWords, saveWords } from '../../../shared/storage.js';

export async function handleExampleActions(e) {
  const playExBtn = e.target.closest('.play-example-btn');
  if (playExBtn) {
    const sentence = playExBtn.getAttribute('data-sentence');
    if (sentence) playSentenceAudio(sentence, 'us');
    return;
  }

  const translateBtn = e.target.closest('.translate-example-btn');
  if (translateBtn) {
    const container = translateBtn.closest('.feedback-example');
    if (container) {
      const textEl = container.querySelector('.feedback-example-text');
      const transEl = container.querySelector('.feedback-example-translation');
      if (textEl && transEl) {
        if (transEl.style.display === 'block') {
          transEl.style.display = 'none'; translateBtn.classList.remove('active');
        } else {
          let trans = transEl.textContent.trim().replace(/^"|"$/g, '');
          if (!trans) {
            const targetLang = await getStored('spelt_target_lang');
            if (!targetLang || targetLang === 'none') {
              alert('Please configure a preferred language in Settings first.'); return;
            }
            const rawExample = textEl.textContent.trim().replace(/^"|"$/g, '');
            transEl.textContent = 'Translating...'; transEl.style.display = 'block';
            const fetchedTrans = await fetchTranslation(rawExample, targetLang);
            if (fetchedTrans) {
              trans = fetchedTrans; transEl.textContent = `"${trans}"`;
              const wordAttr = container.getAttribute('data-word');
              if (wordAttr) {
                const allWords = await getWords();
                const wObj = allWords.find(w => w.word.toLowerCase() === wordAttr.toLowerCase());
                if (wObj) { wObj.exampleTranslation = trans; await saveWords(allWords); }
              }
            } else {
              transEl.textContent = 'Translation failed'; return;
            }
          }
          transEl.style.display = 'block'; translateBtn.classList.add('active');
        }
      }
    }
  }
}
