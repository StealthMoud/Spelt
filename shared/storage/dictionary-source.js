import { triggerNetworkSuccess, triggerNetworkError } from './core.js';
import { parseCambridgePage, parseOxfordPage } from './cambridge-parser.js';

const cambridgeCache = new Map();
const oxfordCache = new Map();

export async function getCambridgeDocument(word) {
  const cleanWord = word.trim().toLowerCase();
  const urlWord = cleanWord.replace(/\s+/g, '-');
  if (cambridgeCache.has(cleanWord)) {
    return cambridgeCache.get(cleanWord);
  }

  const promise = (async () => {
    try {
      const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(urlWord)}`;
      const res = await fetch(url);
      if (res.ok) {
        triggerNetworkSuccess();
        const html = await res.text();
        const parsed = parseCambridgePage(html);
        return { html, parsed };
      }
    } catch (err) {
      triggerNetworkError();
      console.info('Cambridge fetch failed:', err.message || err);
    }
    return { html: '', parsed: { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '', senses: [], allLevels: [], usHeadword: '', ukHeadword: '' } };
  })();

  cambridgeCache.set(cleanWord, promise);
  return promise;
}

export async function getOxfordDocument(word) {
  const cleanWord = word.trim().toLowerCase();
  const urlWord = cleanWord.replace(/\s+/g, '-');
  if (oxfordCache.has(cleanWord)) {
    return oxfordCache.get(cleanWord);
  }

  const promise = (async () => {
    try {
      const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(urlWord)}`;
      const res = await fetch(url);
      if (res.ok) {
        triggerNetworkSuccess();
        const html = await res.text();
        const parsed = parseOxfordPage(html);
        return { html, parsed };
      }
    } catch (err) {
      triggerNetworkError();
      console.info('Oxford fallback fetch failed:', err.message || err);
    }
    return { html: '', parsed: { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '', senses: [], allLevels: [], usHeadword: '', ukHeadword: '' } };
  })();

  oxfordCache.set(cleanWord, promise);
  return promise;
}

export function clearDictionaryCache() {
  cambridgeCache.clear();
  oxfordCache.clear();
}

export async function enrichWord(word) {
  const cleanWord = word.trim().toLowerCase();
  const cam = await getCambridgeDocument(cleanWord);
  let ox = { html: '', parsed: {} };

  const hasAudio = cam.parsed.ukAudio || cam.parsed.usAudio;
  const hasIpa = cam.parsed.ukIpa || cam.parsed.usIpa;
  const hasDef = cam.parsed.senses?.length > 0;
  if (!hasAudio || !hasIpa || !hasDef) {
    ox = await getOxfordDocument(cleanWord);
  }

  const result = { ...cam.parsed };
  if (!result.ukAudio) result.ukAudio = ox.parsed.ukAudio || '';
  if (!result.ukIpa) result.ukIpa = ox.parsed.ukIpa || '';
  if (!result.usAudio) result.usAudio = ox.parsed.usAudio || '';
  if (!result.usIpa) result.usIpa = ox.parsed.usIpa || '';
  if (!result.level) result.level = ox.parsed.level || '';

  let definition = cam.parsed.senses?.[0]?.definition || '';
  if (!definition && cam.html) {
    const regex = /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    if ((match = regex.exec(cam.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text.endsWith(':')) text = text.slice(0, -1).trim();
      definition = text;
    }
  }
  if (!definition && ox.html) {
    const regex = /<span\s+class="def"[^>]*>([\s\S]*?)<\/span>/g;
    let match;
    if ((match = regex.exec(ox.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text.endsWith(':')) text = text.slice(0, -1).trim();
      definition = text;
    }
  }

  let example = '';
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
    if (sentences.length > 0) example = sentences[0];
  }
  if (!example && ox.html) {
    const regex = /<span\s+class="x"[^>]*>([\s\S]*?)<\/span>/g;
    let match;
    const sentences = [];
    while ((match = regex.exec(ox.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.toLowerCase().includes(cleanWord)) {
        sentences.push(text);
      }
    }
    if (sentences.length > 0) example = sentences[0];
  }

  return {
    definition,
    example,
    ipa: result.ukIpa || result.usIpa || '',
    ukIpa: result.ukIpa || '',
    usIpa: result.usIpa || '',
    ukAudio: result.ukAudio || '',
    usAudio: result.usAudio || '',
    level: result.level || '',
    allLevels: result.allLevels || []
  };
}
