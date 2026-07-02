import { getWords, saveWords, askGeminiText, isGeminiConfigured, getStored } from '../../../shared/storage.js';

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
 * Generate a 1-sentence grammatical tip explaining a syntax structure pattern.
 */
export async function generateSyntaxExplanation(card) {
  const targetLang = await getStored('spelt_target_lang') || 'fa';
  let targetLangName = 'Farsi (Persian)';
  if (targetLang === 'es') targetLangName = 'Spanish';
  else if (targetLang === 'fr') targetLangName = 'French';
  else if (targetLang === 'de') targetLangName = 'German';
  else if (targetLang === 'it') targetLangName = 'Italian';
  else if (targetLang === 'pt') targetLangName = 'Portuguese';
  else if (targetLang === 'ru') targetLangName = 'Russian';
  else if (targetLang === 'ar') targetLangName = 'Arabic';
  else if (targetLang === 'fa') targetLangName = 'Farsi (Persian)';
  else if (targetLang === 'zh') targetLangName = 'Chinese Simplified';
  else if (targetLang === 'ja') targetLangName = 'Japanese';
  else if (targetLang === 'ko') targetLangName = 'Korean';
  else if (targetLang === 'tr') targetLangName = 'Turkish';

  const prompt = `You are a syntax and grammar coach helping a student learn English sentence structure.
The structure pattern they are studying is: "${card.definition}"
Example sentence: "${card.example}"
Translation in ${targetLangName}: "${card.translation || 'N/A'}"

Provide a brief, clear, 1-2 sentence explanation of this grammatical structure and how to construct it. If appropriate, write the explanation in a mix of English and ${targetLangName} so it is easy to understand. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Verify a student's custom practice sentence using AI.
 */
export async function verifyPracticeWriting(card, userSentence, mode) {
  let prompt = '';
  if (mode === 'syntax') {
    prompt = `You are a syntax and writing coach. The student is practicing the sentence structure pattern: "${card.definition}".
Target structure example: "${card.example}"
They wrote the following sentence to try and replicate this structure:
"${userSentence}"

Evaluate their sentence:
1. Did they correctly follow the syntax structure pattern?
2. Are the spelling, punctuation, and grammar correct?
3. Does it sound natural in English?

Provide a friendly, encouraging review in 2-3 sentences.
Format your response in clean HTML:
- Start with a status indicator: e.g., "<span style='color: #10b981; font-weight: 700;'>✓ Correct Pattern</span>" or "<span style='color: #ef4444; font-weight: 700;'>✗ Pattern Incorrect</span>".
- If corrections are needed, add: "<div style='margin-top: 4px;'><strong>Correction:</strong> ...</div>"
- Add: "<div style='margin-top: 4px;'><strong>Coach Feedback:</strong> ...</div>"

Do NOT use markdown code blocks (\`\`\`).`;
  } else {
    // Spelling or Recall mode vocabulary practice
    prompt = `You are a vocabulary and writing coach. The student is practicing using the English word/phrase: "${card.word}" (Part of speech: "${card.partOfSpeech}", Definition: "${card.definition || 'N/A'}").
They wrote the following sentence to practice using it:
"${userSentence}"

Evaluate their sentence:
1. Did they use the word "${card.word}" correctly in context?
2. Are the spelling, punctuation, and grammar correct?
3. Does it sound natural in English?

Provide a friendly, encouraging review in 2-3 sentences.
Format your response in clean HTML:
- Start with a status indicator: e.g., "<span style='color: #10b981; font-weight: 700;'>✓ Correct Usage</span>" or "<span style='color: #ef4444; font-weight: 700;'>✗ Usage/Grammar Incorrect</span>".
- If corrections are needed, add: "<div style='margin-top: 4px;'><strong>Correction:</strong> ...</div>"
- Add: "<div style='margin-top: 4px;'><strong>Coach Feedback:</strong> ...</div>"

Do NOT use markdown code blocks (\`\`\`).`;
  }

  return await askGeminiText(prompt);
}

/**
 * Check if AI features are available.
 */
export { isGeminiConfigured };

