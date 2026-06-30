import { getStored, triggerNetworkSuccess, triggerNetworkError } from './core.js';
import { fetchCambridgePronunciation } from './cambridge.js';

// Play high-quality human audio pronunciation with fallback
export async function playWordAudio(word, accent) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const cleanWord = word.trim().toLowerCase();

  // If the word contains a space (e.g. "opt out"), play using natural phrase TTS
  if (cleanWord.includes(' ')) {
    await playTextAudio(word, accent);
    return;
  }

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

// Play text (sentences, definitions) using Google Translate TTS with SpeechSynthesis fallback
export async function playTextAudio(text, accent) {
  if (typeof window === 'undefined') return;
  const clean = text.trim();
  if (!clean) return;

  window.speechSynthesis?.cancel();

  // Primary: Google Translate TTS — natural neural voice
  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&tl=${lang}&q=${encodeURIComponent(clean)}&textlen=${clean.length}`;

  try {
    const response = await fetch(ttsUrl);
    if (response.ok) {
      triggerNetworkSuccess();
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      await audio.play();
      return;
    }
  } catch (err) {
    triggerNetworkError();
    console.info('Google Translate TTS failed, falling back to SpeechSynthesis...');
  }

  // Fallback: browser SpeechSynthesis
  if (typeof window.speechSynthesis !== 'undefined') {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

// Backwards-compatible wrapper for sentence audio
export function playSentenceAudio(sentence, accent) {
  playTextAudio(sentence, accent);
}
