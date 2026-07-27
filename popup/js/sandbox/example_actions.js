import { playTextAudio, getStored, fetchTranslation, atomicUpdate } from '../../../shared/storage.js';
import { showConfirm } from '../vault/confirm.js';

export async function handleExampleActions(e) {
  const playExBtn = e.target.closest('.play-example-btn');
  if (playExBtn) {
    const sentence = playExBtn.getAttribute('data-sentence');
    if (sentence) playTextAudio(sentence, 'us');
    return;
  }

  const translateBtn = e.target.closest('.translate-example-btn');
  if (translateBtn) {
    const container = translateBtn.closest('.feedback-example');
    if (container) {
      const textEl = container.querySelector('.feedback-example-text');
      const transEl = container.querySelector('.feedback-example-translation');
      if (textEl && transEl) {
        if (!transEl.classList.contains('hidden')) {
          transEl.classList.add('hidden'); translateBtn.classList.remove('active');
        } else {
          let trans = transEl.textContent.trim().replace(/^"|"$/g, '');
          if (!trans) {
            const targetLang = await getStored('spelt_target_lang');
            if (!targetLang || targetLang === 'none') {
              showConfirm('Preferred Language Required', 'Please configure a preferred language in Settings first.', null, false); return;
            }
            const rawExample = textEl.textContent.trim().replace(/^"|"$/g, '');
            transEl.textContent = 'Translating...'; transEl.classList.remove('hidden');
            const fetchedTrans = await fetchTranslation(rawExample, targetLang);
            if (fetchedTrans) {
              trans = fetchedTrans; transEl.textContent = `"${trans}"`;
              const wordAttr = container.getAttribute('data-word');
              if (wordAttr) {
                await atomicUpdate(async (allWords) => {
                  const wObj = allWords.find(w => w.word.toLowerCase() === wordAttr.toLowerCase());
                  if (wObj) { wObj.exampleTranslation = trans; }
                });
              }
            } else {
              transEl.textContent = 'Translation failed'; return;
            }
          }
          transEl.classList.remove('hidden'); translateBtn.classList.add('active');
        }
      }
    }
  }
}
