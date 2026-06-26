import { translateWord, fetchCambridgePronunciation } from '../../../shared/storage.js';

export function registerAutofillListeners() {
  document.getElementById('form-auto-fill-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const word = document.getElementById('form-word')?.value.trim();
    if (!word) return;
    const btn = document.getElementById('form-auto-fill-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (res.ok) {
        const data = await res.json();
        const first = data[0];
        document.getElementById('form-definition').value = first.meanings[0]?.definitions[0]?.definition || '';
        let ipa = '', level = '';
        try {
          const cambridge = await fetchCambridgePronunciation(word);
          ipa = cambridge.ukIpa && cambridge.usIpa ? (cambridge.ukIpa === cambridge.usIpa ? cambridge.ukIpa : `${cambridge.ukIpa} (UK) / ${cambridge.usIpa} (US)`) : (cambridge.ukIpa || cambridge.usIpa || '');
          level = cambridge.level || '';
        } catch (_) {}
        if (!ipa) ipa = first.phonetics.find(p => p.text)?.text || '';
        document.getElementById('form-transcription').value = ipa;
        document.getElementById('form-level').value = level ? level.toUpperCase().trim() : '';
        document.getElementById('form-part-of-speech').value = first.meanings[0]?.partOfSpeech || '';
        let example = '';
        if (first.meanings) {
          outerLoop: for (const m of first.meanings) {
            if (m.definitions) {
              for (const d of m.definitions) {
                if (d.example) { example = d.example.trim(); break outerLoop; }
              }
            }
          }
        }
        document.getElementById('form-example').value = example;
      }
      document.getElementById('form-translation').value = await translateWord(word);
    } catch (_) {} finally {
      btn.disabled = false; btn.style.opacity = '1';
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
