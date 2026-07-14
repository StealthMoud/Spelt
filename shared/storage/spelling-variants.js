/**
 * US↔UK Spelling Variant Mapping
 * 
 * Provides utilities to detect and resolve American vs British spelling variants.
 * American spelling is treated as the primary/default form in the app.
 */

// Comprehensive US → UK spelling pairs
// Key = US spelling, Value = UK spelling
const US_TO_UK = {
  // -ize / -ise
  'organize': 'organise', 'recognize': 'recognise', 'realize': 'realise',
  'apologize': 'apologise', 'authorize': 'authorise', 'capitalize': 'capitalise',
  'categorize': 'categorise', 'characterize': 'characterise', 'civilize': 'civilise',
  'colonize': 'colonise', 'criticize': 'criticise', 'customize': 'customise',
  'emphasize': 'emphasise', 'equalize': 'equalise', 'familiarize': 'familiarise',
  'fertilize': 'fertilise', 'finalize': 'finalise', 'generalize': 'generalise',
  'globalize': 'globalise', 'harmonize': 'harmonise', 'hospitalize': 'hospitalise',
  'hypothesize': 'hypothesise', 'idealize': 'idealise', 'immunize': 'immunise',
  'industrialize': 'industrialise', 'initialize': 'initialise', 'itemize': 'itemise',
  'legalize': 'legalise', 'liberalize': 'liberalise', 'localize': 'localise',
  'materialize': 'materialise', 'maximize': 'maximise', 'memorize': 'memorise',
  'minimize': 'minimise', 'modernize': 'modernise', 'monopolize': 'monopolise',
  'nationalize': 'nationalise', 'naturalize': 'naturalise', 'neutralize': 'neutralise',
  'normalize': 'normalise', 'optimize': 'optimise', 'patronize': 'patronise',
  'penalize': 'penalise', 'polarize': 'polarise', 'popularize': 'popularise',
  'pressurize': 'pressurise', 'prioritize': 'prioritise', 'privatize': 'privatise',
  'rationalize': 'rationalise', 'revolutionize': 'revolutionise', 'satirize': 'satirise',
  'scandalize': 'scandalise', 'specialize': 'specialise', 'stabilize': 'stabilise',
  'standardize': 'standardise', 'subsidize': 'subsidise', 'summarize': 'summarise',
  'symbolize': 'symbolise', 'sympathize': 'sympathise', 'synchronize': 'synchronise',
  'terrorize': 'terrorise', 'traumatize': 'traumatise', 'trivialize': 'trivialise',
  'urbanize': 'urbanise', 'utilize': 'utilise', 'vandalize': 'vandalise',
  'victimize': 'victimise', 'visualize': 'visualise', 'vocalize': 'vocalise',

  // -ization / -isation
  'organization': 'organisation', 'authorization': 'authorisation',
  'civilization': 'civilisation', 'colonization': 'colonisation',
  'customization': 'customisation', 'globalization': 'globalisation',
  'hospitalization': 'hospitalisation', 'industrialization': 'industrialisation',
  'initialization': 'initialisation', 'legalization': 'legalisation',
  'liberalization': 'liberalisation', 'localization': 'localisation',
  'maximization': 'maximisation', 'minimization': 'minimisation',
  'modernization': 'modernisation', 'nationalization': 'nationalisation',
  'normalization': 'normalisation', 'optimization': 'optimisation',
  'polarization': 'polarisation', 'popularization': 'popularisation',
  'prioritization': 'prioritisation', 'privatization': 'privatisation',
  'rationalization': 'rationalisation', 'realization': 'realisation',
  'recognition': 'recognition', // same in both
  'specialization': 'specialisation', 'stabilization': 'stabilisation',
  'standardization': 'standardisation', 'synchronization': 'synchronisation',
  'urbanization': 'urbanisation', 'utilization': 'utilisation',
  'visualization': 'visualisation',

  // -or / -our
  'color': 'colour', 'favor': 'favour', 'flavor': 'flavour',
  'harbor': 'harbour', 'honor': 'honour', 'humor': 'humour',
  'labor': 'labour', 'neighbor': 'neighbour', 'rumor': 'rumour',
  'savior': 'saviour', 'valor': 'valour', 'vigor': 'vigour',
  'behavior': 'behaviour', 'endeavor': 'endeavour', 'tumor': 'tumour',
  'splendor': 'splendour', 'glamor': 'glamour', 'armor': 'armour',
  'clamor': 'clamour', 'demeanor': 'demeanour', 'parlor': 'parlour',
  'rancor': 'rancour', 'rigor': 'rigour', 'candor': 'candour',
  'fervor': 'fervour', 'odor': 'odour',
  'favorite': 'favourite', 'favorable': 'favourable', 'favorably': 'favourably',
  'honorable': 'honourable', 'honorably': 'honourably', 'colored': 'coloured',
  'coloring': 'colouring', 'colorful': 'colourful', 'behavioral': 'behavioural',
  'neighborhood': 'neighbourhood', 'labored': 'laboured', 'laborer': 'labourer',
  'rumored': 'rumoured', 'flavoring': 'flavouring',

  // -er / -re
  'center': 'centre', 'theater': 'theatre', 'fiber': 'fibre',
  'liter': 'litre', 'meter': 'metre', 'saber': 'sabre',
  'somber': 'sombre', 'caliber': 'calibre', 'specter': 'spectre',
  'luster': 'lustre', 'maneuver': 'manoeuvre', 'meager': 'meagre',

  // -se / -ce (nouns)
  'license': 'licence', 'defense': 'defence', 'offense': 'offence',
  'pretense': 'pretence',

  // -og / -ogue
  'analog': 'analogue', 'catalog': 'catalogue', 'dialog': 'dialogue',
  'monolog': 'monologue', 'prolog': 'prologue', 'epilog': 'epilogue',

  // -l / -ll
  'traveled': 'travelled', 'traveling': 'travelling', 'traveler': 'traveller',
  'canceled': 'cancelled', 'canceling': 'cancelling', 'counselor': 'counsellor',
  'counseling': 'counselling', 'fueled': 'fuelled', 'fueling': 'fuelling',
  'labeled': 'labelled', 'labeling': 'labelling', 'leveled': 'levelled',
  'leveling': 'levelling', 'modeled': 'modelled', 'modeling': 'modelling',
  'paneled': 'panelled', 'paneling': 'panelling', 'signaled': 'signalled',
  'signaling': 'signalling', 'totaled': 'totalled', 'totaling': 'totalling',

  // -yze / -yse
  'analyze': 'analyse', 'paralyze': 'paralyse', 'catalyze': 'catalyse',
  'dialyze': 'dialyse',

  // -ment (judgment/judgement)
  'judgment': 'judgement', 'acknowledgment': 'acknowledgement',

  // Miscellaneous
  'airplane': 'aeroplane', 'aluminum': 'aluminium', 'artifact': 'artefact',
  'check': 'cheque', 'curb': 'kerb', 'donut': 'doughnut',
  'draft': 'draught', 'gray': 'grey', 'jewelry': 'jewellery',
  'math': 'maths', 'mom': 'mum', 'pajamas': 'pyjamas',
  'plow': 'plough', 'program': 'programme', 'skeptic': 'sceptic',
  'skeptical': 'sceptical', 'skepticism': 'scepticism', 'tire': 'tyre',
  'fulfillment': 'fulfilment', 'enrollment': 'enrolment',
  'installment': 'instalment', 'skillful': 'skilful',
  'willful': 'wilful', 'fulfill': 'fulfil', 'enroll': 'enrol',
  'install': 'instal', 'distill': 'distil', 'instill': 'instil',
  'aging': 'ageing', 'ax': 'axe', 'cozy': 'cosy',
  'mustache': 'moustache', 'licorice': 'liquorice',
};

// Build reverse lookup: UK → US
const UK_TO_US = {};
for (const [us, uk] of Object.entries(US_TO_UK)) {
  UK_TO_US[uk] = us;
}

/**
 * Get spelling variant information for a word.
 * @param {string} word - The word to look up (any case)
 * @returns {{ us: string, uk: string } | null} - US/UK pair, or null if no known variant
 */
export function getSpellingVariant(word) {
  if (!word) return null;
  const lower = word.toLowerCase().trim();
  
  // Check if it's a US spelling in static DB
  if (US_TO_UK[lower]) {
    return { us: lower, uk: US_TO_UK[lower] };
  }
  
  // Check if it's a UK spelling in static DB
  if (UK_TO_US[lower]) {
    return { us: UK_TO_US[lower], uk: lower };
  }

  // Fallback to heuristic rules
  const usNorm = normalizeToUs(lower);
  const ukNorm = normalizeToUk(lower);

  if (usNorm !== lower) {
    return { us: usNorm, uk: lower };
  }
  if (ukNorm !== lower) {
    return { us: lower, uk: ukNorm };
  }
  
  return null;
}

/**
 * Check if two words are valid US/UK spelling variants of each other.
 * @param {string} word1 
 * @param {string} word2 
 * @returns {boolean}
 */
export function areSpellingVariants(word1, word2) {
  if (!word1 || !word2) return false;
  const a = word1.toLowerCase().trim();
  const b = word2.toLowerCase().trim();
  if (a === b) return true;
  
  const variant = getSpellingVariant(a);
  if (variant && (variant.us === b || variant.uk === b)) {
    return true;
  }
  
  return normalizeToUs(a) === normalizeToUs(b);
}

/**
 * Given a word, return the US spelling if a variant exists, otherwise the word itself.
 * @param {string} word 
 * @returns {string}
 */
export function toUsSpelling(word) {
  if (!word) return word;
  const variant = getSpellingVariant(word);
  if (variant) return variant.us;
  return word.toLowerCase().trim();
}

/**
 * Given a word, return the UK spelling if a variant exists, otherwise the word itself.
 * @param {string} word 
 * @returns {string}
 */
export function toUkSpelling(word) {
  if (!word) return word;
  const variant = getSpellingVariant(word);
  if (variant) return variant.uk;
  return word.toLowerCase().trim();
}

// ── Heuristic Normalizers ────────────────────────────────────────────

function normalizeToUs(word) {
  if (!word) return '';
  let w = word.toLowerCase().trim();

  if (UK_TO_US[w]) return UK_TO_US[w];
  if (US_TO_UK[w]) return w;

  // 1. -our -> -or
  w = w.replace(/(\w+)our(s|ly|able|ably|ability|ite|ites|ed|ing|ist|ists|ment|hood)?\b/g, (match, base, suffix) => {
    const baseLower = base.toLowerCase();
    if (['p', 't', 's', 'fl', 'h', 'f', 'y', 'our'].includes(baseLower)) {
      return match;
    }
    return base + 'or' + (suffix || '');
  });

  // 2. -ise / -isation / -isable / -ising / -ised -> -ize / -ization / -izable / -izing / -ized
  const exclusionsIse = [
    'exercise', 'advise', 'devise', 'surprise', 'promise', 'compromise',
    'supervise', 'arise', 'rise', 'raise', 'despise', 'disguise',
    'enterprise', 'merchandise', 'advertise', 'revise', 'praise',
    'appraise', 'chastise', 'comprise', 'demise', 'excise', 'incise',
    'premise', 'surmise', 'televise'
  ];

  let isExcluded = false;
  for (const excl of exclusionsIse) {
    if (w.startsWith(excl)) {
      isExcluded = true;
      break;
    }
  }

  if (!isExcluded) {
    w = w.replace(/isation(s)?\b/g, 'ization$1');
    w = w.replace(/ise(s|d|r|rs|able|ability|ing)?\b/g, 'ize$1');
    w = w.replace(/yse(s|d|r|rs|able|ability|ing)?\b/g, 'yze$1');
  }

  // 3. -logue -> -log
  w = w.replace(/logue(s)?\b/g, 'log$1');

  // 4. Double 'll' -> Single 'l'
  w = w.replace(/([aeiou])ll(ed|ing|er|ers|est|or|ors|ist|ists|y)\b/g, (match, vowel, suffix) => {
    const root = w.slice(0, w.indexOf('ll'));
    const exclusionsL = [
      'compe', 'contro', 'prope', 'rebe', 'exce', 'dispe', 'expe', 'impe', 'patro',
      'a', 'ca', 'fa', 'ha', 'ma', 'ta', 'wa', 'pu', 'fu', 'fi', 'bi', 'mi', 'ti', 'wi', 'ski', 'spi', 'thri', 'chi', 'she'
    ];
    if (exclusionsL.includes(root)) {
      return match;
    }
    return vowel + 'l' + suffix;
  });

  // 5. -re -> -er preceded by consonant (except c/g)
  w = w.replace(/([^cgo])re\b/g, '$1er');

  // 6. -ence -> -ense (only for license, defense, offense, pretense)
  w = w.replace(/(def|off|pret|lic)ence(s)?\b/g, '$1ense$2');

  return w;
}

function normalizeToUk(word) {
  if (!word) return '';
  let w = word.toLowerCase().trim();

  if (US_TO_UK[w]) return US_TO_UK[w];
  if (UK_TO_US[w]) return w;

  // 1. -or -> -our
  w = w.replace(/(\w+)or(s|ly|able|ably|ability|ite|ites|ed|ing|ist|ists|ment|hood)?\b/g, (match, base, suffix) => {
    const baseLower = base.toLowerCase();
    const exclusionsOr = [
      'doct', 'act', 'fact', 'mot', 'err', 'horr', 'mirr', 'sens', 'collect', 'direct', 
      'select', 'invest', 'translat', 'calculat', 'cre-at', 'creat', 'inspect', 'conduct',
      'instruct', 'edit', 'invent', 'narrat', 'surviv', 'spons', 'anch', 'auth', 'tut',
      'sculpt', 'visit', 'competit', 'exhibit', 'trait', 'audit', 'debt', 'process',
      'profess', 'assess', 'possess', 'oppress', 'depress', 'compress', 'express',
      'impress', 'suppress', 'aggress', 'regress', 'progress', 'digress', 'congress',
      'fl', 'h', 'f', 'p', 't', 's', 'y'
    ];
    if (exclusionsOr.some(ex => baseLower.endsWith(ex) || baseLower === ex)) {
      return match;
    }
    return base + 'our' + (suffix || '');
  });

  // 2. -ize -> -ise
  const exclusionsIze = [
    'size', 'capsize', 'seize', 'prize', 'maize', 'gaze', 'daze', 'blaze', 'craze', 'graze'
  ];
  let isExcluded = false;
  for (const excl of exclusionsIze) {
    if (w.startsWith(excl)) {
      isExcluded = true;
      break;
    }
  }
  if (!isExcluded) {
    w = w.replace(/ization(s)?\b/g, 'isation$1');
    w = w.replace(/ize(s|d|r|rs|able|ability|ing)?\b/g, 'ise$1');
    w = w.replace(/yze(s|d|r|rs|able|ability|ing)?\b/g, 'yse$1');
  }

  // 3. -log -> -logue
  w = w.replace(/(\w+)log(s)?\b/g, (match, base, plural) => {
    const baseLower = base.toLowerCase();
    const exclusionsLog = ['b', 'c', 'd', 'f', 'fr', 'j', '', 'sm'];
    if (exclusionsLog.includes(baseLower)) {
      return match;
    }
    return base + 'logue' + (plural || '');
  });

  // 4. Single 'l' -> Double 'l'
  w = w.replace(/([aeiou])l(ed|ing|er|ers|est|or|ors|ist|ists|y)\b/g, (match, vowel, suffix) => {
    const root = w.slice(0, w.indexOf('l'));
    const exclusionsL = [
      'compe', 'contro', 'prope', 'rebe', 'exce', 'dispe', 'expe', 'impe', 'patro',
      'a', 'ca', 'fa', 'ha', 'ma', 'ta', 'wa', 'pu', 'fu', 'fi', 'bi', 'mi', 'ti', 'wi', 'ski', 'spi', 'thri', 'chi', 'she'
    ];
    if (exclusionsL.includes(root)) {
      return match;
    }
    return vowel + 'll' + suffix;
  });

  // 5. -er -> -re preceded by consonant (except c/g)
  w = w.replace(/([^cgo])er\b/g, (match, char) => {
    const exclusionsEr = [
      'aft', 'und', 'ov', 'butt', 'wat', 'lett', 'bett', 'matt', 'wint', 'summ', 'filt', 'sist',
      'oth', 'moth', 'fath', 'broth', 'eith', 'neith', 'leath', 'weath', 'feath', 'gath', 'rath',
      'teth', 'charact', 'mast', 'post', 'comput', 'slid', 'us', 'play', 'read', 'writ', 'speak',
      'sing', 'danc', 'runn', 'walk', 'work', 'teach', 'learn', 'listen', 'watch', 'look', 'find',
      'keep', 'make', 'take', 'give', 'show', 'tell', 'ask', 'call', 'try', 'help', 'need', 'feel',
      'seem', 'become', 'leave', 'put', 'mean', 'let', 'begin', 'start', 'hear', 'play', 'run'
    ];
    const root = w.slice(0, w.lastIndexOf('er'));
    if (exclusionsEr.some(ex => root.endsWith(ex) || root === ex)) {
      return match;
    }
    return char + 're';
  });

  // 6. -ense -> -ence (only for license, defense, offense, pretense)
  w = w.replace(/(def|off|pret|lic)ense(s)?\b/g, '$1ence$2');

  return w;
}
