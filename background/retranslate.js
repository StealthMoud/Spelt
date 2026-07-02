import { getWords, saveWords, askGemini, logDebug } from '../shared/storage.js';

async function updateWordTranslation(wordId, targetLang) {
  const initialList = await getWords();
  const card = initialList.find(x => x.id === wordId);
  if (!card) return;

  const wordStr = card.word;
  let targetLangName = 'Farsi (Persian)';
  if (targetLang === 'es') targetLangName = 'Spanish';
  else if (targetLang === 'fr') targetLangName = 'French';
  else if (targetLang === 'de') targetLangName = 'German';
  else if (targetLang === 'it') targetLangName = 'Italian';
  else if (targetLang === 'pt') targetLangName = 'Portuguese';
  else if (targetLang === 'ru') targetLangName = 'Russian';
  else if (targetLang === 'ar') targetLangName = 'Arabic';
  else if (targetLang === 'fa') targetLangName = 'Farsi (Persian)';
  else if (targetLang === 'zh') targetLangName = 'Chinese Simplified';
  else if (targetLang === 'ja') targetLangName = 'Japanese';
  else if (targetLang === 'ko') targetLangName = 'Korean';
  else if (targetLang === 'tr') targetLangName = 'Turkish';

  const hasExistingData = card.definition || card.translation || card.example;
  
  let prompt = '';
  if (hasExistingData) {
    prompt = `You are a lexicographer helping a language student. Review and improve/clean the existing dictionary data for the word or phrase "${wordStr}".
Here is the current stored data:
{
  "definition": "${(card.definition || '').replace(/"/g, '\\"')}",
  "transcription": "${(card.transcription || '').replace(/"/g, '\\"')}",
  "partOfSpeech": "${(card.partOfSpeech || '').replace(/"/g, '\\"')}",
  "translation": "${(card.translation || '').replace(/"/g, '\\"')}",
  "level": "${(card.level || '').replace(/"/g, '\\"')}",
  "example": "${(card.example || '').replace(/"/g, '\\"')}"
}

Your task:
1. Make the definition clean, concise, and easy to understand in English.
2. Standardize transcription to clear UK/US IPA format (e.g. /iˈnɪɡ.mə/).
3. Clean up the translation in ${targetLangName} (ensure it is contextual and accurate).
4. Verify part of speech (noun, verb, phrasal verb, adjective, etc.).
5. Assign or verify the correct CEFR level (A1, A2, B1, B2, C1, or C2).
6. Improve the example sentence so it is a premium, natural academic/IELTS-style context sentence using the word.

Respond ONLY with a JSON object matching this schema:
{
  "definition": "...",
  "transcription": "...",
  "partOfSpeech": "...",
  "translation": "...",
  "level": "...",
  "example": "..."
}`;
  } else {
    prompt = `You are a lexicographer helping a language student study the word/phrase: "${wordStr}".
Provide the following details in a clean JSON format matching the schema:
{
  "definition": "definition of the word or phrase in English",
  "transcription": "UK / US IPA transcription, e.g. /iˈnɪɡ.mə/",
  "partOfSpeech": "e.g. noun, verb, adjective, adverb, phrasal verb, idiom",
  "translation": "accurate context-aware translation in ${targetLangName}",
  "level": "CEFR level: choose carefully from: A1, A2, B1, B2, C1, C2. Leave blank if none exists",
  "example": "A high-quality IELTS study example sentence containing the word/phrase in context"
}
Respond ONLY with the JSON object. Do not include markdown code block ticks (\`\`\`json).`;
  }

  const aiData = await askGemini(prompt);

  // Load the fresh list from database again to ensure we do not overwrite concurrent UI operations
  const list = await getWords();
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

    await saveWords(list);
  }

  await logDebug({
    word: wordStr,
    hasExistingData,
    aiData
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
    await logDebug({ type: 'start', count: words.length, targetLang });
    if (words.length === 0) return;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      try {
        await updateWordTranslation(w.id, targetLang);
      } catch (err) {
        await logDebug({ word: w.word, error: err.message });
        console.error(`Error refreshing "${w.word}" via AI:`, err);
      }
      // Wait 6 seconds between requests to stay well within the 15 RPM free tier limit
      await new Promise(resolve => setTimeout(resolve, 6000));
    }

    await logDebug({ type: 'completed', count: words.length });
    chrome.runtime.sendMessage({ action: 'retranslateCompleted', count: words.length }).catch(() => {});
  } catch (err) {
    console.error('Background AI refresh failed:', err);
    chrome.runtime.sendMessage({ action: 'retranslateFailed', error: err.message }).catch(() => {});
  }
}
