import { triggerNetworkSuccess, triggerNetworkError } from './core.js';
import { parseCambridgePage, parseOxfordPage } from './cambridge-parser.js';

// Fetch accurate UK/US IPA transcriptions and MP3 URLs dynamically from Cambridge or Oxford Learner's Dictionary
export async function fetchCambridgePronunciation(word) {
  const cleanWord = word.trim().toLowerCase();
  let result = { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '' };
  
  // 1. Try Cambridge Dictionary first
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      result = parseCambridgePage(html);
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge fetch failed:', err.message || err);
  }

  // 2. Fall back to Oxford Learner's Dictionary if Cambridge results are empty (due to 403 or other blocks)
  const hasAudio = result.ukAudio || result.usAudio;
  const hasIpa = result.ukIpa || result.usIpa;
  if (!hasAudio || !hasIpa) {
    try {
      const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(cleanWord)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        triggerNetworkSuccess();
        const html = await res.text();
        const oxResult = parseOxfordPage(html);
        
        // Merge results
        if (!result.ukAudio) result.ukAudio = oxResult.ukAudio;
        if (!result.ukIpa) result.ukIpa = oxResult.ukIpa;
        if (!result.usAudio) result.usAudio = oxResult.usAudio;
        if (!result.usIpa) result.usIpa = oxResult.usIpa;
        if (!result.level) result.level = oxResult.level;
      }
    } catch (err) {
      triggerNetworkError();
      console.info('Oxford fallback fetch failed:', err.message || err);
    }
  }

  return result;
}
