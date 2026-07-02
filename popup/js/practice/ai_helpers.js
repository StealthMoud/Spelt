import { getWords, saveWords, askGeminiText, isGeminiConfigured } from '../../../shared/storage.js';

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

Create a short, creative, memorable mnemonic or memory trick to help the learner:
1. Remember the SPELLING of the word
2. Remember its MEANING

Keep it to 1-3 sentences maximum. Be creative — use wordplay, visual associations, rhymes, acronyms, or etymology. Do NOT use markdown formatting. Just plain text.`;

  const hint = await askGeminiText(prompt);
  
  // Cache the hint on the word object
  try {
    const words = await getWords();
    const w = words.find(x => x.id === card.id);
    if (w) {
      w.aiHint = hint;
      await saveWords(words);
    }
    card.aiHint = hint;
  } catch (_) {}

  return hint;
}

/**
 * Generate AI feedback when the user misspells a word.
 */
export async function generateMisspellingFeedback(card, typedWord) {
  const allErrors = [...new Set([...(card.misspellings || []), typedWord].filter(Boolean))];
  const errorCount = card.totalErrors || allErrors.length;

  const prompt = `You are a friendly spelling coach. The student tried to spell "${card.word}" but typed "${typedWord}".
${allErrors.length > 1 ? `Their past misspellings include: ${allErrors.slice(0, 5).join(', ')}` : ''}
${errorCount > 1 ? `They have misspelled this word ${errorCount} times total.` : ''}

Give a very brief (1-2 sentences), encouraging, specific spelling tip. Point out the exact letter pattern they got wrong and give a memorable trick to avoid it next time. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Generate AI feedback for recall mode when user rates "Again".
 */
export async function generateRecallFeedback(card) {
  const prompt = `You are a vocabulary coach. The student could not recall the meaning of "${card.word}".
Definition: "${card.definition || 'N/A'}"
${card.partOfSpeech ? `Part of speech: ${card.partOfSpeech}` : ''}
${card.example ? `Example: "${card.example}"` : ''}

Give a very brief (1-2 sentences), encouraging tip to help them remember this word's meaning next time. Use an association, etymology, or visual imagery. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Generate AI feedback for incorrect syntax reconstruction/joints.
 */
export async function generateSyntaxFeedback(card, typedJoints) {
  const prompt = `You are a syntax coach helping a student learn how to construct sentences correctly.
They are learning the structure pattern: "${card.definition || 'N/A'}"
The target sentence is: "${card.example || 'N/A'}"
The student's submitted joints/segments: "${typedJoints}"
The correct joints/linking phrases: "${(card.joints || []).join(', ')}"

Provide a brief (1-2 sentences) coaching hint explaining why their assembly or joints selection is incorrect or how they can improve. Keep it simple and encouraging. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}


/**
 * Generate an AI session summary when the practice deck is emptied.
 */
export async function generateSessionSummary(sessionData) {
  const { totalReviewed, correctCount, incorrectCount, hardestWords, totalTimeMs, mode } = sessionData;
  
  const timeStr = totalTimeMs > 0 ? `${Math.round(totalTimeMs / 1000)}s` : 'unknown';
  const accuracy = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0;

  const prompt = `You are a friendly, motivational language learning coach. The student just finished a ${mode} practice session. Here are their results:

- Words reviewed: ${totalReviewed}
- Correct: ${correctCount} (${accuracy}% accuracy)
- Incorrect: ${incorrectCount}
- Total time: ${timeStr}
${hardestWords.length > 0 ? `- Hardest words (got wrong or rated hard): ${hardestWords.slice(0, 5).join(', ')}` : '- All answers were correct!'}

Write a brief, warm, motivational summary (2-4 sentences). Comment on their performance, highlight strengths, suggest focus areas if needed. Be encouraging but honest. Use a casual, coach-like tone. Do NOT use markdown, bullets, or formatting. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Check if AI features are available.
 */
export { isGeminiConfigured };
