export const getFallbackTemplates = (cleanWord) => [
  `Their discussion focused on the role of ${cleanWord} in modern society.`,
  `We must find a way to ${cleanWord} under these difficult circumstances.`,
  `We need to take a ${cleanWord} approach to solve this problem.`,
  `The team worked ${cleanWord} to complete the project on time.`,
  `Could you please use the word ${cleanWord} in a proper sentence?`
];

export function isFallbackExample(word, example) {
  if (!example) return true;
  const cleanWord = word.trim().toLowerCase();
  const cleanEx = example.trim().toLowerCase();
  
  const templates = getFallbackTemplates(cleanWord).map(t => t.toLowerCase());
  return templates.some(t => cleanEx === t);
}

export function getFallbackExample(word, partOfSpeech = '') {
  const cleanWord = word.trim();
  const pos = partOfSpeech.trim().toLowerCase();
  const templates = getFallbackTemplates(cleanWord);

  if (pos.includes('noun')) {
    return templates[0];
  } else if (pos.includes('verb')) {
    return templates[1];
  } else if (pos.includes('adjective') || pos.includes('adj')) {
    return templates[2];
  } else if (pos.includes('adverb') || pos.includes('adv')) {
    return templates[3];
  } else {
    return templates[4];
  }
}

export function censorWordInExample(word, example) {
  if (!example) return '';
  const escapedWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  let pattern = escapedWord;
  if (word.endsWith('e') && word.length > 2) {
    pattern = escapedWord.slice(0, -1) + '(?:e)?';
  }
  let regex;
  if (word.length >= 4) {
    regex = new RegExp('\\b' + pattern + '[a-z]*\\b', 'gi');
  } else {
    regex = new RegExp('\\b' + pattern + '(?:s|es|ed|ing|d|r|er|est|ly|y|ies|ied|ier|iest)?\\b', 'gi');
  }
  return example.replace(regex, '__________');
}
