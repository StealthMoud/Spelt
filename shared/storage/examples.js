import { getCambridgeDocument, getOxfordDocument } from './dictionary-source.js';
import { triggerNetworkSuccess, triggerNetworkError } from './core.js';

// Fetch a real English sentence example dynamically from Cambridge, Oxford, or Tatoeba
export async function fetchDynamicExample(word) {
  const cleanWord = word.trim().toLowerCase();
  
  const pickBest = (list) => {
    const filtered = list.filter(s => {
      if (s.length < 20 || s.length > 150) return false;
      if (/[\[\]\(\)\/=\|]/.test(s)) return false;
      return true;
    });
    const target = filtered.length > 0 ? filtered : list;
    if (target.length === 0) return '';
    target.sort((a, b) => {
      const diffA = Math.abs(a.length - 60);
      const diffB = Math.abs(b.length - 60);
      return diffA - diffB;
    });
    return target[0];
  };

  // 1. Try Cambridge Dictionary
  const cam = await getCambridgeDocument(cleanWord);
  if (cam.html) {
    const regex = /<(div|span)\s+class="examp[^>]*>([\s\S]*?)<\/\1>/g;
    let match;
    const sentences = [];
    while ((match = regex.exec(cam.html))) {
      let text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.toLowerCase().includes(cleanWord)) {
        text = text.replace(/^\[[^\]]+\]\s*/, '').trim();
        text = text.replace(/^(formal|informal|humorous|approving|disapproving|saying)\s+/i, '');
        sentences.push(text);
      }
    }
    const best = pickBest(sentences);
    if (best) return best;
  }

  // 2. Try Oxford Learner's Dictionary
  const ox = await getOxfordDocument(cleanWord);
  if (ox.html) {
    const regex = /<span\s+class="x"[^>]*>([\s\S]*?)<\/span>/g;
    let match;
    const sentences = [];
    while ((match = regex.exec(ox.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.toLowerCase().includes(cleanWord)) {
        sentences.push(text);
      }
    }
    const best = pickBest(sentences);
    if (best) return best;
  }

  // 3. Try Tatoeba API
  try {
    const url = `https://tatoeba.org/en/api_v0/search?from=eng&to=eng&query=${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url);
    if (res.ok) {
      triggerNetworkSuccess();
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const sentences = data.results
          .filter(r => r.lang === 'eng' && r.text.toLowerCase().includes(cleanWord))
          .map(r => r.text);
        const best = pickBest(sentences);
        if (best) return best;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Tatoeba example fetch error:', err.message || err);
  }

  return '';
}
