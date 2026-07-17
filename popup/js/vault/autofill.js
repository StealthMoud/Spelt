import { 
  translateWord, 
  fetchCambridgePronunciation, 
  fetchDynamicDefinition, 
  fetchDynamicExample, 
  getFallbackExample,
  askGemini,
  getStored,
  parseCambridgePage,
  parseOxfordPage
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

/**
 * Parse examples from Cambridge HTML (extracted to avoid duplication).
 */
function extractCambridgeExamples(html, cleanWord) {
  const regex = /<(div|span)\s+class="examp[^>]*>([\s\S]*?)<\/\1>/g;
  let match;
  const sentences = [];
  while (match = regex.exec(html)) {
    let text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.toLowerCase().includes(cleanWord)) {
      text = text.replace(/^\[[^\]]+\]\s*/, '').trim();
      text = text.replace(/^(formal|informal|humorous|approving|disapproving|saying)\s+/i, '');
      sentences.push(text);
    }
  }
  return sentences;
}

/**
 * Parse examples from Oxford HTML.
 */
function extractOxfordExamples(html, cleanWord) {
  const regex = /<span\s+class="x"[^>]*>([\s\S]*?)<\/span>/g;
  let match;
  const sentences = [];
  while (match = regex.exec(html)) {
    const text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text && text.toLowerCase().includes(cleanWord)) {
      sentences.push(text);
    }
  }
  return sentences;
}

/**
 * Pick the best example sentence from a list.
 */
function pickBest(list) {
  const filtered = list.filter(s => {
    if (s.length < 20 || s.length > 150) return false;
    if (/[\[\]\(\)\/=\|]/.test(s)) return false;
    return true;
  });
  const target = filtered.length > 0 ? filtered : list;
  if (target.length === 0) return '';
  target.sort((a, b) => Math.abs(a.length - 60) - Math.abs(b.length - 60));
  return target[0];
}

export function registerAutofillListeners() {
  document.getElementById('form-auto-fill-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (!word) return;
    const btn = document.getElementById('form-auto-fill-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    try {
      const cleanWord = word.trim().toLowerCase();
      const urlWord = cleanWord.replace(/\s+/g, '-');

      // ── SINGLE-FETCH: fetch each unique page exactly once, all in parallel ──
      const [translation, dictApiResult, cambridgeHtml, oxfordHtml] = await Promise.all([
        translateWord(word).catch(() => ''),
        // Free dictionary API
        (async () => {
          try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
            if (response.ok) {
              const data = await response.json();
              const first = data[0];
              if (first) {
                let dictEx = '';
                if (first.meanings) {
                  outerLoop: for (const m of first.meanings) {
                    if (m.definitions) {
                      for (const d of m.definitions) {
                        if (d.example) { dictEx = d.example.trim(); break outerLoop; }
                      }
                    }
                  }
                }
                return {
                  def: first.meanings[0]?.definitions[0]?.definition || '',
                  ipa: first.phonetics.find(p => p.text)?.text || '',
                  pos: first.meanings[0]?.partOfSpeech || '',
                  ex: dictEx
                };
              }
            }
          } catch (_) {}
          return { def: '', ipa: '', pos: '', ex: '' };
        })(),
        // Cambridge — ONE fetch for pronunciation + definition + example
        fetch(`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(urlWord)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(r => r.ok ? r.text() : '').catch(() => ''),
        // Oxford — ONE fetch for fallback pronunciation + definition + example
        fetch(`https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(urlWord)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).then(r => r.ok ? r.text() : '').catch(() => '')
      ]);

      // ── PARSE all data from the single HTML pages (no more network calls) ──
      const cambridge = cambridgeHtml ? parseCambridgePage(cambridgeHtml) : { ukIpa: '', usIpa: '', level: '', senses: [], allLevels: [] };
      const oxford = oxfordHtml ? parseOxfordPage(oxfordHtml) : { ukIpa: '', usIpa: '', level: '' };

      // Merge pronunciation (Cambridge first, Oxford fallback)
      const pronResult = { ...cambridge };
      if (!pronResult.ukIpa) pronResult.ukIpa = oxford.ukIpa || '';
      if (!pronResult.usIpa) pronResult.usIpa = oxford.usIpa || '';

      // Definition: Cambridge senses first, then Oxford regex, then dictAPI
      let definition = cambridge.senses?.[0]?.definition || '';
      if (!definition && cambridgeHtml) {
        const defRegex = /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/;
        const dm = defRegex.exec(cambridgeHtml);
        if (dm) {
          let text = dm[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          if (text.endsWith(':')) text = text.slice(0, -1).trim();
          definition = text;
        }
      }
      if (!definition && oxfordHtml) {
        const oxDefRegex = /<span\s+class="def"[^>]*>([\s\S]*?)<\/span>/;
        const om = oxDefRegex.exec(oxfordHtml);
        if (om) {
          let text = om[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          if (text.endsWith(':')) text = text.slice(0, -1).trim();
          definition = text;
        }
      }
      if (!definition) definition = dictApiResult.def;

      // Example: Cambridge first, then Oxford, then dictAPI, then fallback
      let exampleSentences = cambridgeHtml ? extractCambridgeExamples(cambridgeHtml, cleanWord) : [];
      let example = pickBest(exampleSentences);
      if (!example && oxfordHtml) {
        exampleSentences = extractOxfordExamples(oxfordHtml, cleanWord);
        example = pickBest(exampleSentences);
      }
      if (!example) example = dictApiResult.ex;

      // Level
      let level = cambridge.senses?.find(s => s.level)?.level || cambridge.level || '';
      if (!level) {
        // Try Oxford level
        if (oxford.level) level = oxford.level;
      }
      if (!level) {
        // Lemma fallback — fetch Cambridge only for each lemma (single fetch per lemma)
        const lemmas = getBaseLemmas(word);
        for (const lemma of lemmas) {
          const lemmaUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(lemma)}`;
          try {
            const lres = await fetch(lemmaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (lres.ok) {
              const lhtml = await lres.text();
              const lparsed = parseCambridgePage(lhtml);
              const ll = lparsed.senses?.find(s => s.level)?.level || lparsed.level;
              if (ll) { level = ll; break; }
            }
          } catch (_) {}
        }
      }

      // Transcription
      let transcriptionVal = '';
      if (pronResult.ukIpa || pronResult.usIpa) {
        if (pronResult.ukIpa && pronResult.usIpa) {
          transcriptionVal = pronResult.ukIpa === pronResult.usIpa ? pronResult.ukIpa : `${pronResult.usIpa} (US) / ${pronResult.ukIpa} (UK)`;
        } else {
          transcriptionVal = pronResult.usIpa || pronResult.ukIpa || '';
        }
      } else {
        transcriptionVal = dictApiResult.ipa;
      }

      const finalPos = dictApiResult.pos || 'unknown';
      if (!example) example = getFallbackExample(word, finalPos);

      // ── Populate all fields ──
      document.getElementById('form-translation').value = translation || '';
      document.getElementById('form-definition').value = definition || '';
      document.getElementById('form-transcription').value = transcriptionVal || '';
      document.getElementById('form-level').value = level ? level.toUpperCase().trim() : '';
      document.getElementById('form-part-of-speech').value = finalPos;
      document.getElementById('form-example').value = example || '';

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

      const prompt = `Word: "${word}". Provide JSON:
{"definition":"English definition","transcription":"US / UK IPA (US first, e.g. /lɑːrdʒ/ (US) / /lɑːdʒ/ (UK))","partOfSpeech":"noun/verb/adjective/etc","translation":"${targetLangName} translation","level":"CEFR: A1/A2/B1/B2/C1/C2 or blank","example":"IELTS-level example sentence"}
JSON only. No markdown.`;

      const aiData = await askGemini(prompt, { maxOutputTokens: 1024, temperature: 0.3 });

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
