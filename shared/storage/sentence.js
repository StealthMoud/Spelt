// Check if the given example is a fallback template or an old hardcoded template sentence
export function isFallbackExample(word, example) {
  if (!example) return true;
  const cleanWord = word.trim().toLowerCase();
  const cleanEx = example.trim().toLowerCase();
  
  const oldHardcoded = [
    'the hotel can accommodate up to three hundred guests.',
    'we will definitely attend the conference next week.',
    'please separate the recycling from the general waste.',
    'did you receive the email i sent you yesterday?',
    'i did not mean to embarrass you in front of the team.',
    'we will wait here until the rain finally stops.',
    'the new government promised to lower taxes.',
    'we must do more to protect our natural environment.',
    'the accident occurred at the corner of the street.',
    'he paused on the threshold before entering the room.',
    'his pronunciation of the word was perfectly clear.',
    'she marked the meeting date on her wall calendar.',
    'it is necessary to wear a helmet when riding a bike.',
    'he is currently writing a novel about his travels.',
    'my colleague helped me finish the project on time.',
    'the launch of the new product was highly successful.',
    'we plan to start our journey early tomorrow morning.',
    'the children spent all day playing on the sandy beach.',
    'the test was very easy and everyone passed it.',
    'please try to spell the word again if you make a mistake.',
    'her perseverance in the face of multiple setbacks was truly inspiring.',
    'a civilized society is judged by how it treats its most vulnerable members.',
    'successful collaboration between the two teams led to a breakthrough.',
    'the research team conducted a detailed analysis of the data.',
    'there is a strong correlation between regular study and high test scores.',
    'the experiment provided validation for the scientist\'s theory.',
    'the teacher conducted an assessment of the students\' language skills.',
    'the new results show a significant improvement over the previous trials.'
  ];

  if (oldHardcoded.includes(cleanEx)) return true;

  const templates = [
    `their discussion focused on the role of ${cleanWord} in modern society.`,
    `we must find a way to ${cleanWord} under these difficult circumstances.`,
    `we need to take a ${cleanWord} approach to solve this problem.`,
    `the team worked ${cleanWord} to complete the project on time.`,
    `could you please use the word ${cleanWord} in a proper sentence?`,
    `the local guide showed us where to find the best ${cleanWord} in town.`,
    `they decided to ${cleanWord} the process to make it more efficient.`,
    `it was a ${cleanWord} moment that changed everything for us.`,
    `it was an ${cleanWord} moment that changed everything for us.`,
    `she completed the assignment ${cleanWord} before the deadline.`
  ];

  return templates.some(t => cleanEx === t);
}

// Dynamic fallback example sentence generator for context clues
export function getFallbackExample(word, partOfSpeech = '') {
  const cleanWord = word.trim();
  const pos = partOfSpeech.trim().toLowerCase();
  if (pos.includes('noun')) {
    return `Their discussion focused on the role of ${cleanWord} in modern society.`;
  } else if (pos.includes('verb')) {
    return `We must find a way to ${cleanWord} under these difficult circumstances.`;
  } else if (pos.includes('adjective') || pos.includes('adj')) {
    return `We need to take a ${cleanWord} approach to solve this problem.`;
  } else if (pos.includes('adverb') || pos.includes('adv')) {
    return `The team worked ${cleanWord} to complete the project on time.`;
  } else {
    return `Could you please use the word ${cleanWord} in a proper sentence?`;
  }
}

// Censor the word (including its inflections) in the example sentence
export function censorWordInExample(word, example) {
  if (!example) return '';
  const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
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
