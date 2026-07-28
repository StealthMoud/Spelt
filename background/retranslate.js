import { getWords, askGemini, atomicUpdate } from '../shared/storage.js';
import { getLanguageName } from '../src/core/languages.js';
import { buildEnrichmentPrompt } from '../shared/ai/prompts.js';

async function updateWordTranslation(wordId, targetLang) {
  const initialList = await getWords();
  const card = initialList.find(x => x.id === wordId);
  if (!card) return;

  const wordStr = card.word;
  const targetLangName = getLanguageName(targetLang);

  const prompt = buildEnrichmentPrompt(wordStr, card, targetLangName);

  const aiData = await askGemini(prompt);

  await atomicUpdate(async (list) => {
    const w = list.find(x => x.id === wordId);
    if (w) {
      if (aiData.definition) w.definition = aiData.definition;
      if (aiData.transcription) w.transcription = aiData.transcription;
      if (aiData.partOfSpeech) w.partOfSpeech = aiData.partOfSpeech;
      if (aiData.translation) w.translation = aiData.translation;
      if (aiData.level) {
        w.level = aiData.level.toUpperCase().trim();
        w.otherLevels = []; // Reset other levels as Gemini selects the single best level
      }
      if (aiData.example) {
        if (w.example !== aiData.example) {
          w.example = aiData.example;
          w.exampleTranslation = '';
        }
      }
    }
  });
}

export async function runBackgroundRetranslate(targetLang) {
  try {
    const allowRes = await new Promise(r => chrome.storage?.local.get('spelt_allow_background_ai', r));
    if (!allowRes || !allowRes.spelt_allow_background_ai) {
      console.warn('[Spelt AI] Background AI retranslation aborted: disabled in settings.');
      return;
    }

    const words = await getWords();
    if (words.length === 0) return;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      try {
        await updateWordTranslation(w.id, targetLang);
      } catch (err) {
        console.error(`Error refreshing "${w.word}" via AI:`, err);
      }
      // Wait 6 seconds between requests to stay well within the 15 RPM free tier limit
      await new Promise(resolve => setTimeout(resolve, 6000));
    }

    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background AI refresh failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}
