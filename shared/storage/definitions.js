import { getCambridgeDocument, getOxfordDocument } from './dictionary-source.js';

function definitionFromDocument(document, source) {
  const first = document.parsed.senses?.[0];
  if (first?.definition) return { definition: first.definition, level: first.level, allLevels: document.parsed.allLevels };
  const pattern = source === 'cambridge'
    ? /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/
    : /<span\s+class="def"[^>]*>([\s\S]*?)<\/span>/;
  const match = pattern.exec(document.html);
  const definition = match?.[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().replace(/:$/, '').trim() || '';
  const level = document.parsed.level || '';
  return { definition, level, allLevels: document.parsed.allLevels || (level ? [level] : []) };
}

// Return the first usable definition, without waiting for a slower provider.
export async function fetchDynamicDefinition(word) {
  const cleanWord = word.trim().toLowerCase();
  const sources = [
    getCambridgeDocument(cleanWord).then(doc => definitionFromDocument(doc, 'cambridge')),
    getOxfordDocument(cleanWord).then(doc => definitionFromDocument(doc, 'oxford'))
  ];
  try {
    return await Promise.any(sources.map(async request => {
      const result = await request;
      if (!result.definition) throw new Error('No definition');
      return result;
    }));
  } catch {
    return { definition: '', level: '', allLevels: [] };
  }
}

// Match a definition string to its level from Cambridge senses
export function matchDefinitionLevel(definition, senses) {
  if (!definition || !senses || senses.length === 0) return '';
  const clean = definition.toLowerCase().trim();
  const match = senses.find(s => clean.includes(s.definition.toLowerCase().slice(0, 30)));
  return match?.level || '';
}
