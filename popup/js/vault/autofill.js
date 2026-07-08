import { 
  translateWord, 
  fetchCambridgePronunciation, 
  fetchDynamicDefinition, 
  fetchDynamicExample, 
  getFallbackExample,
  askGemini,
  getStored
} from '../../../shared/storage.js';

function getBaseLemmas(word) {
  const lemmas = [];
  const clean = word.toLowerCase().trim();
  
  if (clean.endsWith('ed') && clean.length > 3) {
    lemmas.push(clean.slice(0, -2));
    lemmas.push(clean.slice(0, -1));
  }
  if (clean.endsWith('ing') && clean.length > 4) {
    lemmas.push(clean.slice(0, -3));
    lemmas.push(clean.slice(0, -3) + 'e');
  }
  if (clean.endsWith('s') && clean.length > 2) {
    if (clean.endsWith('es')) {
      lemmas.push(clean.slice(0, -2));
    }
    lemmas.push(clean.slice(0, -1));
  }
  
  // Handle double consonant base stripping (e.g. running -> run, dropped -> drop)
  const doubleConsonants = ['bb', 'dd', 'ff', 'gg', 'll', 'mm', 'nn', 'pp', 'rr', 'ss', 'tt', 'zz'];
  const extra = [];
  lemmas.forEach(lemma => {
    if (lemma.length > 2) {
      const end = lemma.slice(-2);
      if (doubleConsonants.includes(end)) {
        extra.push(lemma.slice(0, -1));
      }
    }
  });
  lemmas.push(...extra);
  
  return [...new Set(lemmas)].filter(l => l.length > 1 && l !== clean);
}

export function registerAutofillListeners() {
  document.getElementById('form-auto-fill-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (!word) return;
    const btn = document.getElementById('form-auto-fill-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    try {
      // 1. Fetch translation
      let translation = '';
      try {
        translation = await translateWord(word);
      } catch (_) {}
      document.getElementById('form-translation').value = translation || '';

      // 2. Fetch dictionary definitions, partOfSpeech, etc. from dictionary API as a base fallback
      let dictDef = '';
      let dictEx = '';
      let dictIpa = '';
      let dictPos = '';
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
        if (response.ok) {
          const data = await response.json();
          const first = data[0];
          if (first) {
            dictDef = first.meanings[0]?.definitions[0]?.definition || '';
            dictIpa = first.phonetics.find(p => p.text)?.text || '';
            dictPos = first.meanings[0]?.partOfSpeech || '';
            if (first.meanings) {
              outerLoop: for (const m of first.meanings) {
                if (m.definitions) {
                  for (const d of m.definitions) {
                    if (d.example) {
                      dictEx = d.example.trim();
                      break outerLoop;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (_) {}

      // 3. Fetch premium dynamic definition
      const defResult = await fetchDynamicDefinition(word);
      const finalDef = defResult.definition || dictDef;
      document.getElementById('form-definition').value = finalDef || '';

      // 4. Fetch premium transcription
      const cambridge = await fetchCambridgePronunciation(word);
      let transcriptionVal = '';
      if (cambridge.ukIpa || cambridge.usIpa) {
        if (cambridge.ukIpa && cambridge.usIpa) {
          transcriptionVal = cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`;
        } else {
          transcriptionVal = cambridge.ukIpa || cambridge.usIpa || '';
        }
      } else {
        transcriptionVal = dictIpa;
      }
      document.getElementById('form-transcription').value = transcriptionVal || '';

      // 5. Calculate final level and levels with morphological lemma fallback for inflected words
      let finalLevel = defResult.level || cambridge.level || '';
      if (!finalLevel) {
        const lemmas = getBaseLemmas(word);
        for (const lemma of lemmas) {
          const lemmaDef = await fetchDynamicDefinition(lemma);
          if (lemmaDef.level) {
            finalLevel = lemmaDef.level;
            break;
          }
          const lemmaPr = await fetchCambridgePronunciation(lemma);
          if (lemmaPr.level) {
            finalLevel = lemmaPr.level;
            break;
          }
        }
      }
      document.getElementById('form-level').value = finalLevel ? finalLevel.toUpperCase().trim() : '';

      // Sanitize Part of Speech to fall back if currently placeholder "Unknown"
      const finalPos = dictPos || 'unknown';
      document.getElementById('form-part-of-speech').value = finalPos;

      // 6. Fetch premium dynamic example
      let newExample = await fetchDynamicExample(word);
      if (!newExample) newExample = dictEx;
      if (!newExample) {
        newExample = getFallbackExample(word, finalPos);
      }
      document.getElementById('form-example').value = newExample || '';

    } catch (err) {
      console.error('Autofill failed:', err);
    } finally {
      btn.disabled = false; btn.style.opacity = '1';
    }
  });

  document.getElementById('form-ai-fill-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (!word) return;
    const btn = document.getElementById('form-ai-fill-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    const span = btn.querySelector('span');
    const originalText = span ? span.textContent : 'AI';
    if (span) span.textContent = '...';

    try {
      const targetLang = await getStored('spelt_target_lang');
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

      const prompt = `You are a lexicographer helping a language student study the word/phrase: "${word}".
Provide the following details in a clean JSON format matching the schema:
{
  "definition": "definition of the word or phrase in English",
  "transcription": "UK / US IPA transcription, e.g. /iˈnɪɡ.mə/",
  "partOfSpeech": "e.g. noun, verb, adjective, adverb, phrasal verb, idiom",
  "translation": "accurate context-aware translation in ${targetLangName}",
  "level": "CEFR level: choose carefully from: A1, A2, B1, B2, C1, C2. Leave blank if none exists",
  "example": "A high-quality IELTS study example sentence containing the word/phrase in context"
}
Respond ONLY with the JSON object. Do not include markdown block ticks (\`\`\`json).`;

      const aiData = await askGemini(prompt);

      if (aiData.definition) document.getElementById('form-definition').value = aiData.definition;
      if (aiData.transcription) document.getElementById('form-transcription').value = aiData.transcription;
      if (aiData.partOfSpeech) document.getElementById('form-part-of-speech').value = aiData.partOfSpeech;
      if (aiData.translation) document.getElementById('form-translation').value = aiData.translation;
      if (aiData.level) document.getElementById('form-level').value = aiData.level.toUpperCase().trim();
      if (aiData.example) document.getElementById('form-example').value = aiData.example;

    } catch (err) {
      alert(err.message || 'AI Autofill failed. Please check your Gemini API key in Settings.');
    } finally {
      btn.disabled = false; btn.style.opacity = '1';
      if (span) span.textContent = originalText;
    }
  });

  document.getElementById('form-auto-translate-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (!word) return;
    const btn = document.getElementById('form-auto-translate-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    try {
      document.getElementById('form-translation').value = await translateWord(word);
    } catch (err) {
      alert(err.message || 'Translation failed');
    } finally {
      btn.disabled = false; btn.style.opacity = '1';
    }
  });
}
