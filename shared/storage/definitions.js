import { getCambridgeDocument, getOxfordDocument } from './dictionary-source.js';

// Fetch a English definition dynamically from Cambridge or Oxford
// Returns { definition, level, allLevels } with level matched to the definition sense
export async function fetchDynamicDefinition(word) {
  const cleanWord = word.trim().toLowerCase();
  const empty = { definition: '', level: '', allLevels: [] };

  // 1. Try Cambridge Dictionary
  const cam = await getCambridgeDocument(cleanWord);
  if (cam.parsed.senses?.length > 0) {
    const first = cam.parsed.senses[0];
    return { definition: first.definition, level: first.level, allLevels: cam.parsed.allLevels };
  }
  if (cam.html) {
    const regex = /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    if ((match = regex.exec(cam.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text.endsWith(':')) text = text.slice(0, -1).trim();
      if (text) return { definition: text, level: cam.parsed.level, allLevels: cam.parsed.allLevels };
    }
  }

  // 2. Try Oxford Learner's Dictionary
  const ox = await getOxfordDocument(cleanWord);
  if (ox.html) {
    const regex = /<span\s+class="def"[^>]*>([\s\S]*?)<\/span>/g;
    let match;
    if ((match = regex.exec(ox.html))) {
      let text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (text.endsWith(':')) text = text.slice(0, -1).trim();
      let oxLevel = ox.parsed.level || '';
      if (!oxLevel) {
        const oxRegex = /data-ox(?:3000|5000)="([a-c][1-2])"/i;
        const oxMatch = oxRegex.exec(ox.html);
        if (oxMatch) {
          oxLevel = oxMatch[1].toUpperCase();
        }
      }
      return { definition: text, level: oxLevel, allLevels: oxLevel ? [oxLevel] : [] };
    }
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
