export const LANGUAGES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  fa: 'Farsi (Persian)',
  zh: 'Chinese Simplified',
  ja: 'Japanese',
  ko: 'Korean',
  tr: 'Turkish'
};

export function getLanguageName(code) {
  return LANGUAGES[code] || 'Farsi (Persian)';
}
