/**
 * Every Gemini prompt used by the extension.
 *
 * Prompts are kept terse on purpose: the whole prompt is re-sent on every
 * request, so persona preambles ("You are an expert coach...") cost tokens on
 * each call and change nothing about the output for tasks this small. State
 * the task, the constraints, and the output shape.
 */

const ENTRY_SCHEMA = `{
  "word": "...",
  "definition": "...",
  "transcription": "...",
  "partOfSpeech": "...",
  "translation": "...",
  "level": "...",
  "example": "..."
}`;

const escapeJson = (val) => (val || '').replace(/"/g, '\\"');

/**
 * Enrich or clean a dictionary entry. Used by vault bulk enrich, sandbox
 * enhance, vault autofill and the background retranslate job, so all four
 * paths produce the same shape.
 *
 * @param {string} word
 * @param {object} draft Existing card data; omit for a from-scratch lookup.
 * @param {string} targetLangName Human-readable language name.
 */
export function buildEnrichmentPrompt(word, draft = {}, targetLangName = 'English') {
  const hasDraft = draft.definition || draft.translation || draft.example;

  const existing = hasDraft
    ? `
Existing data:
{
  "definition": "${escapeJson(draft.definition)}",
  "transcription": "${escapeJson(draft.transcription)}",
  "partOfSpeech": "${escapeJson(draft.partOfSpeech)}",
  "translation": "${escapeJson(draft.translation)}",
  "level": "${escapeJson(draft.level)}",
  "example": "${escapeJson(draft.example)}"
}
Correct anything wrong and fill anything blank.
`
    : '';

  return `Dictionary entry for "${word}".${existing}
- word: canonical headword or correct spelling in English.
- definition: clear and concise, in English.
- transcription: IPA, US first, e.g. /lɑːrdʒ/ (US) / /lɑːdʒ/ (UK).
- partOfSpeech: noun, verb, adjective, adverb, phrasal verb or idiom.
- translation: contextual ${targetLangName}.
- level: one CEFR level (A1, A2, B1, B2, C1, C2), or "" if unclear.
- example: one natural sentence using the word.

Respond with JSON only:
${ENTRY_SCHEMA}`;
}

/**
 * Mnemonic for a word's spelling and meaning.
 * Shared by the front-face and back-face hint buttons.
 */
export function buildHintPrompt(card, variantNote = '') {
  const typos = card.misspellings?.length
    ? ` Past typos: ${[...new Set(card.misspellings)].slice(0, 3).join(', ')}.`
    : '';

  return `Word: "${card.word}"${card.definition ? ` — ${card.definition}` : ''}${card.partOfSpeech ? ` [${card.partOfSpeech}]` : ''}.${typos}${variantNote}
Give one memory aid for its spelling and meaning. Break the word into roots, prefixes or syllables where that helps.
1-2 sentences. Plain text, no markdown, no preamble.`;
}

/**
 * Targeted correction after a misspelling. Points the model at the exact
 * letters the user got wrong rather than describing the word in general.
 */
export function buildMisspellingPrompt(card, typedWord, variantNote = '') {
  return `Correct spelling: "${card.word}"${card.definition ? ` — ${card.definition}` : ''}.
User typed: "${typedWord}".${variantNote}
Name the exact letters or syllables they got wrong, then give one memory trick for that specific part.
1-2 sentences. Plain text, no markdown, no preamble.`;
}

/** Memory aid for a word's meaning (recall mode). */
export function buildRecallPrompt(card, variantNote = '') {
  return `Word: "${card.word}" — ${card.definition || 'no definition'}${card.partOfSpeech ? ` [${card.partOfSpeech}]` : ''}.${variantNote}
Give one association or root breakdown that makes the meaning stick.
2 sentences max. Plain text, no markdown, no preamble.`;
}

/** End-of-session performance summary. */
export function buildSessionSummaryPrompt({ mode, totalReviewed, accuracy, correctCount, incorrectCount, timeStr, hardestWords = [] }) {
  const hard = hardestWords.length > 0
    ? ` Missed: ${hardestWords.slice(0, 5).join(', ')}.`
    : ' Nothing missed.';

  return `Practice session — mode ${mode}, ${totalReviewed} words, ${accuracy}% accuracy (${correctCount} right, ${incorrectCount} wrong), ${timeStr}.${hard}
Summarise how it went and name one thing to focus on next.
2-3 sentences. Plain text, no markdown, no preamble.`;
}

/** Grade a sentence the user wrote using the target word. */
export function buildWritingCheckPrompt(card, userSentence, variantNote = '') {
  return `Target word: "${card.word}" (${card.partOfSpeech || 'unknown'}) — ${card.definition || 'no definition'}.${variantNote}
Student sentence: "${userSentence}"
Judge whether the word is used correctly and whether the spelling and grammar are right.

Respond with JSON only:
{
  "verdict": "correct" or "incorrect",
  "correction": "the fixed sentence, or empty string if nothing needs fixing",
  "feedback": "one or two sentences of coaching"
}`;
}

/** Whole-library coaching insights for the stats dashboard. */
export function buildStatsInsightsPrompt(statsSummary) {
  return `Vocabulary practice statistics:
${statsSummary}

Write coaching notes based only on these numbers, citing the figures.

Respond with JSON only. Every value is plain text with no markup:
{
  "overview": ["3 or 4 short bullet points covering the biggest themes"],
  "vocabulary": "1-2 sentences on vocabulary growth (CEFR spread, velocity, problem words)",
  "activity": "1-2 sentences on review consistency (streak, sessions)",
  "performance": "1-2 sentences on speed and accuracy"
}`;
}
