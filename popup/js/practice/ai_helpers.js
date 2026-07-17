import { getWords, saveWords, askGeminiText, askGeminiTextStream, isGeminiConfigured, getStored, atomicUpdate, getSpellingVariant, areSpellingVariants } from '../../../shared/storage.js';

// ── Speed config: tight output limits for snappy responses ──────────
const FAST_OPTS = { maxOutputTokens: 150, temperature: 0.3 };
const MEDIUM_OPTS = { maxOutputTokens: 256, temperature: 0.4 };

// ── In-memory cache for misspelling feedback (word::typed → feedback) ──
const feedbackCache = new Map();

/**
 * Generate a mnemonic hint for a word using AI.
 * Caches the result to `word.aiHint` to avoid repeated API calls.
 */
export async function generateHint(card) {
  // Return cached hint if available
  if (card.aiHint) return card.aiHint;

  const variant = getSpellingVariant(card.word);
  const variantNote = variant && variant.us !== variant.uk
    ? ` US "${variant.us}" / UK "${variant.uk}".`
    : '';

  const prompt = `Mnemonic for "${card.word}"${card.definition ? ` (${card.definition})` : ''}${card.partOfSpeech ? ` [${card.partOfSpeech}]` : ''}${card.misspellings?.length ? `. Common typos: ${[...new Set(card.misspellings)].slice(0, 3).join(', ')}` : ''}${variantNote}
Break the word into recognizable parts (roots, prefixes, suffixes) to remember spelling and meaning. 1-2 sentences. No greetings, no markdown. Plain text only.`;

  const hint = await askGeminiText(prompt, FAST_OPTS);
  
  // Cache the hint on the word object
  try {
    await atomicUpdate(async (words) => {
      const w = words.find(x => x.id === card.id);
      if (w) w.aiHint = hint;
    });
    card.aiHint = hint;
  } catch (_) {}

  return hint;
}

export async function generateMisspellingFeedback(card, typedWord) {
  // Check if the "misspelling" is actually a valid US/UK variant
  const isVariant = areSpellingVariants(typedWord, card.word);
  if (isVariant) {
    const variant = getSpellingVariant(typedWord);
    const typedVariant = variant && variant.us === typedWord.toLowerCase() ? 'American' : 'British';
    return `"${typedWord}" is the valid ${typedVariant} English spelling. Both US (${variant.us}) and UK (${variant.uk}) are correct.`;
  }

  // Check in-memory cache
  const cacheKey = `${card.word}::${typedWord.toLowerCase()}`;
  if (feedbackCache.has(cacheKey)) return feedbackCache.get(cacheKey);

  const allErrors = [...new Set([...(card.misspellings || []), typedWord].filter(Boolean))];
  const errorCount = card.totalErrors || allErrors.length;

  const variant = getSpellingVariant(card.word);
  const variantNote = variant && variant.us !== variant.uk
    ? ` (US "${variant.us}" / UK "${variant.uk}" are both valid.)`
    : '';

  const prompt = `Correct: "${card.word}". Typed: "${typedWord}".${errorCount > 1 ? ` Misspelled ${errorCount}x.` : ''}${allErrors.length > 1 ? ` Past errors: ${allErrors.slice(0, 3).join(', ')}.` : ''}${variantNote}
Identify the exact mistake, give correction, and a memorable trick to prevent it. 2-3 sentences max. No fluff, no markdown. Plain text.`;

  const feedback = await askGeminiText(prompt, FAST_OPTS);

  // Cache result
  feedbackCache.set(cacheKey, feedback);
  return feedback;
}

/**
 * Streaming variant — calls onChunk(text) as words arrive.
 * Falls back to non-streaming if streaming fails.
 */
export async function generateMisspellingFeedbackStream(card, typedWord, onChunk) {
  const isVariant = areSpellingVariants(typedWord, card.word);
  if (isVariant) {
    const variant = getSpellingVariant(typedWord);
    const typedVariant = variant && variant.us === typedWord.toLowerCase() ? 'American' : 'British';
    const msg = `"${typedWord}" is the valid ${typedVariant} English spelling. Both US (${variant.us}) and UK (${variant.uk}) are correct.`;
    if (onChunk) onChunk(msg);
    return msg;
  }

  const cacheKey = `${card.word}::${typedWord.toLowerCase()}`;
  if (feedbackCache.has(cacheKey)) {
    const cached = feedbackCache.get(cacheKey);
    if (onChunk) onChunk(cached);
    return cached;
  }

  const allErrors = [...new Set([...(card.misspellings || []), typedWord].filter(Boolean))];
  const errorCount = card.totalErrors || allErrors.length;

  const variant = getSpellingVariant(card.word);
  const variantNote = variant && variant.us !== variant.uk
    ? ` (US "${variant.us}" / UK "${variant.uk}" are both valid.)`
    : '';

  const prompt = `Correct: "${card.word}". Typed: "${typedWord}".${errorCount > 1 ? ` Misspelled ${errorCount}x.` : ''}${allErrors.length > 1 ? ` Past errors: ${allErrors.slice(0, 3).join(', ')}.` : ''}${variantNote}
Identify the exact mistake, give correction, and a memorable trick to prevent it. 2-3 sentences max. No fluff, no markdown. Plain text.`;

  try {
    const result = await askGeminiTextStream(prompt, FAST_OPTS, onChunk);
    feedbackCache.set(cacheKey, result);
    return result;
  } catch (err) {
    // Fallback to non-streaming
    const result = await askGeminiText(prompt, FAST_OPTS);
    feedbackCache.set(cacheKey, result);
    if (onChunk) onChunk(result);
    return result;
  }
}

/**
 * Generate AI feedback for recall mode when user rates "Again".
 */
export async function generateRecallFeedback(card) {
  const variant = getSpellingVariant(card.word);
  const variantNote = variant && variant.us !== variant.uk
    ? ` (US/UK: ${variant.us}/${variant.uk})`
    : '';

  const prompt = `Memory aid for "${card.word}" — ${card.definition || 'N/A'}${card.partOfSpeech ? ` [${card.partOfSpeech}]` : ''}${variantNote}.
Give a memorable association, root breakdown, or visual trick for the meaning. 2 sentences max. No greetings, no markdown. Plain text.`;

  return await askGeminiText(prompt, FAST_OPTS);
}

export async function generateSessionSummary(sessionData) {
  const { totalReviewed, correctCount, incorrectCount, hardestWords, totalTimeMs, mode } = sessionData;
  
  const timeStr = totalTimeMs > 0 ? `${Math.round(totalTimeMs / 1000)}s` : 'unknown';
  const accuracy = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0;

  const prompt = `Session: ${mode}, ${totalReviewed} words, ${accuracy}% accuracy (${correctCount}✓ ${incorrectCount}✗), ${timeStr}.${hardestWords.length > 0 ? ` Hard: ${hardestWords.slice(0, 5).join(', ')}.` : ' All correct!'}
Summarize performance, highlight strengths and focus areas. 2-3 sentences. No fluff, no markdown. Plain text.`;

  return await askGeminiText(prompt, MEDIUM_OPTS);
}

export async function verifyPracticeWriting(card, userSentence, mode) {
  const variant = getSpellingVariant(card.word);
  const variantNote = variant && variant.us !== variant.uk
    ? ` US/UK: ${variant.us}/${variant.uk} both valid.`
    : '';

  const prompt = `Word: "${card.word}" (${card.partOfSpeech || 'unknown'}, "${card.definition || 'N/A'}").${variantNote}
Student wrote: "${userSentence}"
Evaluate: correct usage, spelling/grammar, naturalness. 2 sentences max. No fluff.
HTML format: Start with <span style='color: #10b981; font-weight: 700;'>✓ Correct Usage</span> or <span style='color: #ef4444; font-weight: 700;'>✗ Incorrect</span>. If corrections needed: <div style='margin-top: 4px;'><strong>Correction:</strong> ...</div>. Add: <div style='margin-top: 4px;'><strong>Coach Feedback:</strong> ...</div>. No markdown code blocks.`;

  return await askGeminiText(prompt, MEDIUM_OPTS);
}

/**
 * Check if AI features are available.
 */
export { isGeminiConfigured };
