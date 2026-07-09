import { getWords, saveWords, askGeminiText, isGeminiConfigured, getStored, atomicUpdate } from '../../../shared/storage.js';

/**
 * Generate a mnemonic hint for a word using AI.
 * Caches the result to `word.aiHint` to avoid repeated API calls.
 */
export async function generateHint(card) {
  // Return cached hint if available
  if (card.aiHint) return card.aiHint;

  const prompt = `You are a vocabulary coach helping a language learner memorize the English word/phrase: "${card.word}".
${card.definition ? `Definition: "${card.definition}"` : ''}
${card.transcription ? `Pronunciation: ${card.transcription}` : ''}
${card.partOfSpeech ? `Part of speech: ${card.partOfSpeech}` : ''}
${card.misspellings?.length ? `Common misspellings: ${[...new Set(card.misspellings)].slice(0, 5).join(', ')}` : ''}

Create a short, intuitive, and highly logical mnemonic or memory trick to help the learner remember:
1. The SPELLING of the word (ensure any spelling trick or breakdown is 100% accurate and makes sense).
2. The MEANING of the word.

Focus on breaking down the word into real, recognizable parts (e.g., roots, prefixes, suffixes, simpler constituent words) or logical visual associations. Avoid convoluted logic, nonsensical links, or inaccurate spelling claims. Keep it to 1-2 sentences maximum.
CRITICAL: Be completely direct. Avoid any greetings, pleasantries, introductory fluff, or encouraging phrases (e.g. do NOT say "Here is a hint", "To remember this word"). Go straight to the mnemonic hint. Do NOT use markdown formatting. Just plain text.`;

  const hint = await askGeminiText(prompt);
  
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
  const allErrors = [...new Set([...(card.misspellings || []), typedWord].filter(Boolean))];
  const errorCount = card.totalErrors || allErrors.length;

  const prompt = `Evaluate the spelling error for the word "${card.word}" when the student typed "${typedWord}".
${allErrors.length > 1 ? `Their past misspellings include: ${allErrors.slice(0, 5).join(', ')}` : ''}
${errorCount > 1 ? `They have misspelled this word ${errorCount} times total.` : ''}

Analyze the error:
1. Identify the exact mistake in "${typedWord}" compared to the correct spelling "${card.word}". If there are past misspellings, detect if there is a recurring pattern or trap (e.g., suffix confusion, vowel substitutions, or doubled letters).
2. Give a direct correction explanation.
3. Provide a memorable trick, mnemonic breakdown, prefix/suffix rule, or association to help the correct spelling stick in their mind easily and prevent future mistakes.

Ensure the feedback is direct, objective, and concise (2-3 sentences max). Do NOT use any encouraging fluff, greetings, pleasantries, or motivational phrases (e.g., do NOT say "Nice attempt!", "Keep practicing!", "Here is a trick"). Keep the feedback strictly technical and helpful. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Generate AI feedback for recall mode when user rates "Again".
 */
export async function generateRecallFeedback(card) {
  const prompt = `Provide a memory aid for the meaning of "${card.word}".
Definition: "${card.definition || 'N/A'}"
${card.partOfSpeech ? `Part of speech: ${card.partOfSpeech}` : ''}
${card.example ? `Example: "${card.example}"` : ''}

Provide a direct, highly concise tip (2 sentences max) using a memorable association, root breakdown, etymology, or visual trick to help the word's meaning stick in the mind easily. Do NOT use any encouraging words, greetings, pleasantries, or fluff. Go straight to the memory trick. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

export async function generateSessionSummary(sessionData) {
  const { totalReviewed, correctCount, incorrectCount, hardestWords, totalTimeMs, mode } = sessionData;
  
  const timeStr = totalTimeMs > 0 ? `${Math.round(totalTimeMs / 1000)}s` : 'unknown';
  const accuracy = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0;

  const prompt = `Provide a direct, concise summary of the student's practice session results (2-3 sentences max).
- Mode: ${mode}
- Words reviewed: ${totalReviewed}
- Correct: ${correctCount} (${accuracy}% accuracy)
- Incorrect: ${incorrectCount}
- Total time: ${timeStr}
${hardestWords.length > 0 ? `- Hardest words (got wrong or rated hard): ${hardestWords.slice(0, 5).join(', ')}` : '- All answers were correct!'}

Summarize the performance directly, highlighting strengths and specific focus areas if applicable. Do NOT use any warm greetings, encouraging filler, or motivational fluff (e.g., do NOT say "Great job!", "Keep up the fantastic work!"). Be completely direct and objective. Do NOT use markdown, bullets, or formatting. Plain text only.`;

  return await askGeminiText(prompt);
}

export async function verifyPracticeWriting(card, userSentence, mode) {
  const prompt = `Evaluate the student's practice sentence using the English word/phrase: "${card.word}" (Part of speech: "${card.partOfSpeech}", Definition: "${card.definition || 'N/A'}").
They wrote the following sentence:
"${userSentence}"

Evaluate their sentence:
1. Did they use the word "${card.word}" correctly in context?
2. Are the spelling, punctuation, and grammar correct?
3. Does it sound natural in English?

Provide a direct, concise evaluation in 2 sentences max. Do NOT use any encouraging fluff, pleasantries, or filler in the Coach Feedback (e.g. do NOT say 'Nice effort!', 'Good try!', 'Keep practicing!'). Keep the feedback strictly technical and direct.
Format your response in clean HTML:
- Start with a status indicator: e.g., "<span style='color: #10b981; font-weight: 700;'>✓ Correct Usage</span>" or "<span style='color: #ef4444; font-weight: 700;'>✗ Usage/Grammar Incorrect</span>".
- If corrections are needed, add: "<div style='margin-top: 4px;'><strong>Correction:</strong> ...</div>"
- Add: "<div style='margin-top: 4px;'><strong>Coach Feedback:</strong> ...</div>"

Do NOT use markdown code blocks (\`\`\`).`;

  return await askGeminiText(prompt);
}

/**
 * Check if AI features are available.
 */
export { isGeminiConfigured };

