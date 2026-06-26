import { getStored, triggerNetworkSuccess, triggerNetworkError } from './core.js';

// Helper to fetch translation from Google Translate API for highly accurate and responsive single-word translation
export async function fetchTranslation(word, targetLang) {
  if (!targetLang || targetLang === 'none') return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(word)}`;
    const res = await fetch(url);
    if (res.ok) {
      triggerNetworkSuccess();
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0].trim();
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Translation fetch failed:', err.message || err);
  }
  return '';
}

// Translate a word using the user's preferred target language
export async function translateWord(word) {
  const targetLang = await getStored('spelt_target_lang');
  if (!targetLang || targetLang === 'none') {
    throw new Error('Please configure a preferred language in Settings.');
  }
  return await fetchTranslation(word, targetLang);
}
