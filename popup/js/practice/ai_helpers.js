import { askGeminiText, askGeminiTextStream, isGeminiConfigured, atomicUpdate, getSpellingVariant, areSpellingVariants } from '../../../shared/storage.js';
import {
  buildHintPrompt,
  buildMisspellingPrompt,
  buildRecallPrompt,
  buildSessionSummaryPrompt,
  buildWritingCheckPrompt
} from '../../../shared/ai/prompts.js';

// Interactive buttons: cap output and drop the model's thinking pass. These
// prompts ask for 1-2 sentences, so thinking only adds latency.
const FAST_OPTS = { maxOutputTokens: 350, temperature: 0.3, thinking: false };
// Summaries and grading are short too, but benefit from a little reasoning.
const MEDIUM_OPTS = { maxOutputTokens: 512, temperature: 0.4 };

// word::typed -> feedback, for this session only.
const feedbackCache = new Map();
const MIN_USABLE_LENGTH = 20;

/** US/UK note appended to prompts when the word has two valid spellings. */
function variantNoteFor(word) {
  const variant = getSpellingVariant(word);
  return variant && variant.us !== variant.uk
    ? ` Both US "${variant.us}" and UK "${variant.uk}" are valid.`
    : '';
}

/**
 * If the "misspelling" is just the other side of a US/UK pair, answer locally.
 * Saves a request and is always correct.
 */
function variantExplanation(card, typedWord) {
  if (!areSpellingVariants(typedWord, card.word)) return null;
  const variant = getSpellingVariant(typedWord);
  if (!variant) return null;
  const which = variant.us === typedWord.toLowerCase() ? 'American' : 'British';
  return `"${typedWord}" is the valid ${which} English spelling. Both US (${variant.us}) and UK (${variant.uk}) are correct.`;
}

function readCache(key) {
  const cached = feedbackCache.get(key);
  if (typeof cached === 'string' && cached.trim().length >= MIN_USABLE_LENGTH) return cached;
  feedbackCache.delete(key);
  return null;
}

/**
 * Mnemonic for a word, streamed so the first words appear immediately.
 * Persists to `card.aiHint`, so re-opening the panel costs nothing.
 *
 * @param {object} card
 * @param {(text: string) => void} [onChunk] Receives the accumulated text.
 */
export async function generateHint(card, onChunk) {
  if (typeof card.aiHint === 'string' && card.aiHint.trim().length >= 15) {
    onChunk?.(card.aiHint);
    return card.aiHint;
  }

  const prompt = buildHintPrompt(card, variantNoteFor(card.word));

  let hint;
  try {
    hint = await askGeminiTextStream(prompt, FAST_OPTS, onChunk);
  } catch (_err) {
    hint = await askGeminiText(prompt, FAST_OPTS);
    onChunk?.(hint);
  }

  try {
    await atomicUpdate(async (words) => {
      const w = words.find(x => x.id === card.id);
      if (w) w.aiHint = hint;
    });
    card.aiHint = hint;
  } catch (_) { /* persisting the cache is best-effort */ }

  return hint;
}

/**
 * Targeted feedback after a misspelling, streamed.
 * Falls back to a single non-streaming call if the stream fails.
 */
export async function generateMisspellingFeedbackStream(card, typedWord, onChunk) {
  const local = variantExplanation(card, typedWord);
  if (local) {
    onChunk?.(local);
    return local;
  }

  const cacheKey = `${card.word}::${typedWord.toLowerCase()}`;
  const cached = readCache(cacheKey);
  if (cached) {
    onChunk?.(cached);
    return cached;
  }

  const prompt = buildMisspellingPrompt(card, typedWord, variantNoteFor(card.word));

  let result;
  try {
    result = await askGeminiTextStream(prompt, FAST_OPTS, onChunk);
  } catch (_err) {
    result = await askGeminiText(prompt, FAST_OPTS);
    onChunk?.(result);
  }

  feedbackCache.set(cacheKey, result);
  return result;
}

/** Memory aid for a word's meaning, used in recall mode. */
export async function generateRecallFeedback(card, onChunk) {
  const prompt = buildRecallPrompt(card, variantNoteFor(card.word));
  try {
    return await askGeminiTextStream(prompt, FAST_OPTS, onChunk);
  } catch (_err) {
    const text = await askGeminiText(prompt, FAST_OPTS);
    onChunk?.(text);
    return text;
  }
}

export async function generateSessionSummary(sessionData) {
  const { totalReviewed, correctCount, incorrectCount, hardestWords, totalTimeMs, mode } = sessionData;

  const prompt = buildSessionSummaryPrompt({
    mode,
    totalReviewed,
    correctCount,
    incorrectCount,
    hardestWords,
    accuracy: totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0,
    timeStr: totalTimeMs > 0 ? `${Math.round(totalTimeMs / 1000)}s` : 'unknown duration'
  });

  return await askGeminiText(prompt, MEDIUM_OPTS);
}

/**
 * Grade a sentence the user wrote. Returns a structured verdict.
 * Throws if the reply cannot be parsed — a failed parse must never be
 * presented to the student as a pass.
 */
export async function verifyPracticeWriting(card, userSentence, _mode) {
  const prompt = buildWritingCheckPrompt(card, userSentence, variantNoteFor(card.word));
  const raw = await askGeminiText(prompt, MEDIUM_OPTS);

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
  } catch (err) {
    throw new Error('The AI reply could not be read. Please try again.', { cause: err });
  }

  return {
    verdict: parsed.verdict === 'incorrect' ? 'incorrect' : 'correct',
    correction: typeof parsed.correction === 'string' ? parsed.correction.trim() : '',
    feedback: typeof parsed.feedback === 'string' && parsed.feedback.trim()
      ? parsed.feedback.trim()
      : 'No feedback returned.'
  };
}

export { isGeminiConfigured };
