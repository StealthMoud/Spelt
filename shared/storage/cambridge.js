import { getCambridgeDocument, getOxfordDocument } from './dictionary-source.js';

// Fetch accurate UK/US IPA transcriptions and MP3 URLs dynamically from Cambridge or Oxford Learner's Dictionary
export async function fetchCambridgePronunciation(word) {
  const cleanWord = word.trim().toLowerCase();
  
  // 1. Try Cambridge Dictionary first
  const cam = await getCambridgeDocument(cleanWord);
  let result = { ...cam.parsed };

  // 2. Fall back to Oxford Learner's Dictionary if Cambridge results are empty (due to 403 or other blocks)
  const hasAudio = result.ukAudio || result.usAudio;
  const hasIpa = result.ukIpa || result.usIpa;
  if (!hasAudio || !hasIpa) {
    const ox = await getOxfordDocument(cleanWord);
    const oxResult = ox.parsed;
    if (!result.ukAudio) result.ukAudio = oxResult.ukAudio;
    if (!result.ukIpa) result.ukIpa = oxResult.ukIpa;
    if (!result.usAudio) result.usAudio = oxResult.usAudio;
    if (!result.usIpa) result.usIpa = oxResult.usIpa;
    if (!result.level) result.level = oxResult.level;
  }

  return result;
}
