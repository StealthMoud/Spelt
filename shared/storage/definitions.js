import { triggerNetworkSuccess, triggerNetworkError } from './core.js';
import { parseCambridgePage } from './cambridge-parser.js';

// Fetch a premium English definition dynamically from Cambridge or Oxford
// Returns { definition, level, allLevels } with level matched to the definition sense
export async function fetchDynamicDefinition(word) {
  const cleanWord = word.trim().toLowerCase();
  const empty = { definition: '', level: '', allLevels: [] };

  // 1. Try Cambridge Dictionary
  try {
    const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(cleanWord)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      triggerNetworkSuccess();
      const html = await res.text();
      const parsed = parseCambridgePage(html);
      if (parsed.senses.length > 0) {
        const first = parsed.senses[0];
        return { definition: first.definition, level: first.level, allLevels: parsed.allLevels };
      }
      // Fallback: plain regex if senses parsing missed
      const regex = /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return { definition: text, level: parsed.level, allLevels: parsed.allLevels };
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
      const regex = /<span\s+class="def"[^>]*>([\s\S]*?)<\/span>/g;
      let match;
      if (match = regex.exec(html)) {
        let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) text = text.slice(0, -1).trim();
        if (text) return { definition: text, level: '', allLevels: [] };
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Oxford definition fetch failed:', err.message || err);
  }

  return empty;
}

// Match a definition string to its level from Cambridge senses
export function matchDefinitionLevel(definition, senses) {
  if (!definition || !senses || senses.length === 0) return '';
  const clean = definition.toLowerCase().trim();
  const match = senses.find(s => clean.includes(s.definition.toLowerCase().slice(0, 30)));
  return match?.level || '';
}
