import { triggerNetworkSuccess, triggerNetworkError } from './core.js';

// Fetch a premium English definition dynamically from Cambridge or Oxford
export async function fetchDynamicDefinition(word) {
  const cleanWord = word.trim().toLowerCase();

  // 1. Try Cambridge Dictionary
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<div\s+class=\"def ddef_d[^>]*>([\s\S]*?)<\/div>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return text;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge definition fetch failed:', err.message || err);
  }

  // 2. Try Oxford Learner's Dictionary
  try {
    const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const regex = /<span\s+class=\"def\"[^>]*>([\s\S]*?)<\/span>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return text;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Oxford definition fetch failed:', err.message || err);
  }

  return '';
}
