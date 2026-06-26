import { getStored, triggerNetworkSuccess, triggerNetworkError } from './core.js';
import { fetchCambridgePronunciation } from './cambridge.js';

// Play high-quality human audio pronunciation with fallback
export async function playWordAudio(word, accent) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const cleanWord = word.trim().toLowerCase();

  // 1. Try Cambridge Dictionary audio first
  try {
    const cambridge = await fetchCambridgePronunciation(cleanWord);
    const cambridgeUrl = accent === 'uk' ? cambridge.ukAudio : cambridge.usAudio;
    if (cambridgeUrl) {
      // Fetch audio file as a Blob to bypass Chrome Extension CORS limitations
      const response = await fetch(cambridgeUrl);
      if (response.ok) {
        triggerNetworkSuccess();
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        await audio.play();
        return;
      }
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Cambridge pronunciation play failed, trying static fallback...');
  }

  const suffix = accent === 'uk' ? 'gb' : 'us';
  const primaryUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(cleanWord)}--_${suffix}_1.mp3`;

  try {
    const audio = new Audio(primaryUrl);
    await audio.play();
    return;
  } catch (e) {
    console.info('Google static audio failed, trying API dictionary fallback...');
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (res.ok) {
      triggerNetworkSuccess();
      const data = await res.json();
      if (data && data[0] && data[0].phonetics) {
        const audios = data[0].phonetics.map(p => p.audio).filter(Boolean);
        const accentMatch = audios.find(a => a.includes(`-${accent}`) || a.includes(`/${accent}/`));
        const fallbackAudio = accentMatch || audios[0];
        if (fallbackAudio) {
          const audio = new Audio(fallbackAudio);
          await audio.play();
          return;
        }
      }
    }
  } catch (e) {
    triggerNetworkError();
    console.info('Dictionary API fallback failed, using TTS...');
  }

  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

// Play full sentence using Web Speech API (speechSynthesis)
export function playSentenceAudio(sentence, accent) {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence.trim());
  utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
