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

/**
 * Generate AI feedback when the user misspells a word.
 */
export async function generateMisspellingFeedback(card, typedWord) {
  const allErrors = [...new Set([...(card.misspellings || []), typedWord].filter(Boolean))];
  const errorCount = card.totalErrors || allErrors.length;

  const prompt = `Evaluate the spelling error for the word "${card.word}" when the student typed "${typedWord}".
${allErrors.length > 1 ? `Their past misspellings include: ${allErrors.slice(0, 5).join(', ')}` : ''}
${errorCount > 1 ? `They have misspelled this word ${errorCount} times total.` : ''}

Give a direct, highly concise spelling tip (1-2 sentences max). Point out the exact mistake/letter pattern they got wrong and how to fix it. Do NOT use any encouraging words, greetings, pleasantries, or fluff (e.g., do NOT say "Great effort!", "Nice try!", "Keep practicing!"). Go straight to the correction. Do NOT use markdown. Plain text only.`;

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

Give a direct, highly concise tip (1-2 sentences max) using an association, root breakdown, etymology, or visual imagery to help remember the meaning. Do NOT use any encouraging words, greetings, pleasantries, or fluff (e.g., do NOT say "Don't worry!", "Great effort!", "Nice try!"). Go straight to the memory tip. Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

export async function generateSyntaxFeedback(card, typedJoints) {
  const prompt = `Evaluate the sentence structure error.
They are learning the structure pattern: "${card.definition || 'N/A'}"
The target sentence is: "${card.example || 'N/A'}"
The student's submitted joints/segments: "${typedJoints}"
The correct joints/linking phrases: "${(card.joints || []).join(', ')}"

Provide a direct, highly concise explanation (1-2 sentences max) pointing out the error in their joints/assembly and how to correct it. Do NOT use any encouraging words, greetings, pleasantries, or fluff (e.g., do NOT say "Great effort!", "Nice try!", "Keep it up!"). Go straight to the explanation. Do NOT use markdown. Plain text only.`;

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

Provide a brief, clear, 1-2 sentence explanation of this grammatical structure and how to construct it.
CRITICAL INSTRUCTION: To prevent text direction issues, you MUST provide the English explanation on one line, and the ${targetLangName} translation on a completely separate new line. Do NOT mix English and ${targetLangName} on the same line.
Do NOT use any introductory fluff, greetings, or encouraging words. Go straight to the grammatical explanation.
Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

/**
 * Generate a subtle puzzle hint to help order scrambled syntax blocks.
 */
export async function generateSyntaxPuzzleHint(card) {
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
The student is trying to reconstruct a scrambled sentence based on this structure pattern: "${card.definition}"
The correct sentence is: "${card.example}"

Provide a subtle, 1-2 sentence hint to help the student figure out how to order the sentence clauses. 
For example, you can give a hint about what the sentence should start with, or the logical relationship between the clauses.
DO NOT give them the full correct sentence. DO NOT just give them the answer.
Do NOT use any greeting, pleasantries, or encouraging fluff. Write the hint directly.
Write the hint entirely in ${targetLangName}.
Do NOT use markdown. Plain text only.`;

  return await askGeminiText(prompt);
}

export async function verifyPracticeWriting(card, userSentence, mode) {
  let prompt = '';
  if (mode === 'syntax') {
    prompt = `Evaluate the student's custom practice sentence for the structure pattern: "${card.definition}".
Target structure example: "${card.example}"
They wrote the following sentence:
"${userSentence}"

Evaluate their sentence:
1. Did they correctly follow the syntax structure pattern?
2. Are the spelling, punctuation, and grammar correct?
3. Does it sound natural in English?

Provide a direct, concise evaluation in 2 sentences max. Do NOT use any encouraging fluff, pleasantries, or filler in the Coach Feedback (e.g. do NOT say 'Nice effort!', 'Good try!', 'Keep practicing!'). Keep the feedback strictly technical and direct.
Format your response in clean HTML:
- Start with a status indicator: e.g., "<span style='color: #10b981; font-weight: 700;'>✓ Correct Pattern</span>" or "<span style='color: #ef4444; font-weight: 700;'>✗ Pattern Incorrect</span>".
- If corrections are needed, add: "<div style='margin-top: 4px;'><strong>Correction:</strong> ...</div>"
- Add: "<div style='margin-top: 4px;'><strong>Coach Feedback:</strong> ...</div>"

Do NOT use markdown code blocks (\`\`\`).`;
  } else {
    // Spelling or Recall mode vocabulary practice
    prompt = `Evaluate the student's practice sentence using the English word/phrase: "${card.word}" (Part of speech: "${card.partOfSpeech}", Definition: "${card.definition || 'N/A'}").
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
  }

  return await askGeminiText(prompt);
}

/**
 * Check if AI features are available.
 */
export { isGeminiConfigured };

