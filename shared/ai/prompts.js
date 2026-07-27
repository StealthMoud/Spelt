/**
 * Build a prompt for enriching vocabulary dictionary entries via AI.
 */
export function buildEnrichmentPrompt(word, draft = {}, targetLangName = 'English') {
  const safeStr = (val) => (val || '').replace(/"/g, '\\"');
  
  return `Review and refine dictionary data for the word "${word}".
Existing data:
{
  "definition": "${safeStr(draft.definition)}",
  "transcription": "${safeStr(draft.transcription)}",
  "partOfSpeech": "${safeStr(draft.partOfSpeech)}",
  "translation": "${safeStr(draft.translation)}",
  "level": "${safeStr(draft.level)}",
  "example": "${safeStr(draft.example)}"
}

Instructions:
1. Provide a clear, concise English definition.
2. Provide standardized UK/US IPA pronunciation (e.g. /iˈnɪɡ.mə/).
3. Specify exact part of speech (noun, verb, adjective, etc.).
4. Provide contextual translation in ${targetLangName}.
5. Assign a CEFR level (A1, A2, B1, B2, C1, or C2).
6. Provide a natural example sentence using the word.

Respond ONLY with a JSON object:
{
  "definition": "...",
  "transcription": "...",
  "partOfSpeech": "...",
  "translation": "...",
  "level": "...",
  "example": "..."
}`;
}
