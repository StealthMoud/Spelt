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
  
  // Check if it's a US spelling
  if (US_TO_UK[lower]) {
    return { us: lower, uk: US_TO_UK[lower] };
  }
  
  // Check if it's a UK spelling
  if (UK_TO_US[lower]) {
    return { us: UK_TO_US[lower], uk: lower };
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
  if (!variant) return false;
  return variant.us === b || variant.uk === b;
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
