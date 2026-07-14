export {
  getStored,
  setStored,
  getWords,
  saveWords,
  atomicUpdate,
  resetDb,
  logDebug,
  triggerNetworkError,
  triggerNetworkSuccess
} from './storage/core.js';

export {
  calcSM2,
  computeErrorWeight,
  getLocalMidnight,
  getNextReviewDate
} from './storage/srs.js';

export {
  registerMisspelling
} from './storage/misspellings.js';

export {
  reviewWord
} from './storage/reviews.js';

export {
  addWord,
  deleteWord
} from './storage/word-actions.js';

export {
  playWordAudio,
  playTextAudio,
  playSentenceAudio
} from './storage/audio.js';

export {
  fetchCambridgePronunciation
} from './storage/cambridge.js';

export {
  fetchTranslation,
  translateWord
} from './storage/translation.js';

export {
  fetchDynamicDefinition,
  matchDefinitionLevel
} from './storage/definitions.js';

export {
  fetchDynamicExample
} from './storage/examples.js';

export {
  isFallbackExample,
  getFallbackExample,
  censorWordInExample
} from './storage/sentence.js';

export {
  getLocalDateString,
  logActivity,
  updateStreak,
  getStreak,
  getActivity,
  logSandboxActivity,
  getSandboxActivity,
  getSessions,
  logSession
} from './storage/sessions.js';

export {
  askGemini,
  askGeminiText,
  isGeminiConfigured,
  getAiStatus,
  GEMINI_AUTO_MODEL,
  getGeminiKeyFingerprint,
  getGeminiKeyLabel,
  getGeminiModelMeta,
  getGeminiModelOptions,
  isSupportedGeminiTextModel,
  sortGeminiModels
} from './storage/gemini.js';

export {
  getSpellingVariant,
  areSpellingVariants,
  toUsSpelling,
  toUkSpelling
} from './storage/spelling-variants.js';
