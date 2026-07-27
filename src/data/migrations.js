import { getStored, setStored } from './storage.js';
import { getLocalMidnight, getNextReviewDate } from '../core/srs.js';

export const CURRENT_SCHEMA_VERSION = 6;

const oldHardcodedExamples = new Set([
  'the hotel can accommodate up to three hundred guests.',
  'we will definitely attend the conference next week.',
  'please separate the recycling from the general waste.',
  'did you receive the email i sent you yesterday?',
  'i did not mean to embarrass you in front of the team.',
  'we will wait here until the rain finally stops.',
  'the new government promised to lower taxes.',
  'we must do more to protect our natural environment.',
  'the accident occurred at the corner of the street.',
  'he paused on the threshold before entering the room.',
  'his pronunciation of the word was perfectly clear.',
  'she marked the meeting date on her wall calendar.',
  'it is necessary to wear a helmet when riding a bike.',
  'he is currently writing a novel about his travels.',
  'my colleague helped me finish the project on time.',
  'the launch of the new product was highly successful.',
  'we plan to start our journey early tomorrow morning.',
  'the children spent all day playing on the sandy beach.',
  'the test was very easy and everyone passed it.',
  'please try to spell the word again if you make a mistake.',
  'her perseverance in the face of multiple setbacks was truly inspiring.',
  'a civilized society is judged by how it treats its most vulnerable members.',
  'successful collaboration between the two teams led to a breakthrough.',
  'the research team conducted a detailed analysis of the data.',
  'there is a strong correlation between regular study and high test scores.',
  'the experiment provided validation for the scientist\'s theory.',
  'the teacher conducted an assessment of the students\' language skills.',
  'the new results show a significant improvement over the previous trials.'
]);

export async function runSchemaMigrations(words) {
  if (!Array.isArray(words)) return [];

  const currentVersion = (await getStored('spelt_schema_version')) || 0;
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return words;
  }

  let modified = false;
  const sanitized = words.map(w => {
    if (!w) return w;
    let cardModified = false;

    if (w.example && oldHardcodedExamples.has(w.example.trim().toLowerCase())) {
      w.example = '';
      cardModified = true;
    }

    if (w.rep === undefined || w.rep === null || isNaN(w.rep)) {
      w.rep = 0; cardModified = true;
    }
    if (w.interval === undefined || w.interval === null || isNaN(w.interval)) {
      w.interval = 0; cardModified = true;
    }
    if (w.ef === undefined || w.ef === null || isNaN(w.ef) || w.ef < 1.3) {
      w.ef = 2.5; cardModified = true;
    }

    if (w.nextDate !== undefined && w.nextDate !== null) {
      if (typeof w.nextDate === 'string') {
        const num = Number(w.nextDate);
        if (!isNaN(num)) {
          w.nextDate = num; cardModified = true;
        } else {
          const parsed = Date.parse(w.nextDate);
          if (!isNaN(parsed)) { w.nextDate = parsed; cardModified = true; }
        }
      } else if (w.nextDate instanceof Date || (typeof w.nextDate === 'object' && w.nextDate?.getTime)) {
        w.nextDate = w.nextDate.getTime(); cardModified = true;
      }
    }
    if (typeof w.nextDate === 'number' && !isNaN(w.nextDate)) {
      const normalizedNextDate = getLocalMidnight(w.nextDate);
      if (w.nextDate !== normalizedNextDate) {
        w.nextDate = normalizedNextDate; cardModified = true;
      }
    }

    if (w.meaningNextDate !== undefined && w.meaningNextDate !== null) {
      if (typeof w.meaningNextDate === 'string') {
        const num = Number(w.meaningNextDate);
        if (!isNaN(num)) {
          w.meaningNextDate = num; cardModified = true;
        } else {
          const parsed = Date.parse(w.meaningNextDate);
          if (!isNaN(parsed)) { w.meaningNextDate = parsed; cardModified = true; }
        }
      } else if (w.meaningNextDate instanceof Date || (typeof w.meaningNextDate === 'object' && w.meaningNextDate?.getTime)) {
        w.meaningNextDate = w.meaningNextDate.getTime(); cardModified = true;
      }
    }
    if (typeof w.meaningNextDate === 'number' && !isNaN(w.meaningNextDate)) {
      const normalizedMeaningNextDate = getLocalMidnight(w.meaningNextDate);
      if (w.meaningNextDate !== normalizedMeaningNextDate) {
        w.meaningNextDate = normalizedMeaningNextDate; cardModified = true;
      }
    }

    if (Array.isArray(w.history) && w.history.length > 0) {
      const lastSpelling = [...w.history].reverse().find(h => h.mode === 'spelling' || h.mode === 'syntax');
      if (lastSpelling && lastSpelling.date && lastSpelling.interval !== undefined) {
        const intervalNum = Number(lastSpelling.interval);
        const dateNum = typeof lastSpelling.date === 'string' ? Date.parse(lastSpelling.date) : Number(lastSpelling.date);
        if (!isNaN(intervalNum) && !isNaN(dateNum)) {
          const isFailed = lastSpelling.q !== undefined && Number(lastSpelling.q) < 3;
          const expectedNext = isFailed ? dateNum : getNextReviewDate(intervalNum, dateNum);
          if (expectedNext > Date.now() && (w.nextDate === undefined || w.nextDate === null || isNaN(w.nextDate))) {
            w.nextDate = expectedNext; cardModified = true;
          }
        }
      }
    }

    if (w.nextDate === undefined || w.nextDate === null || isNaN(w.nextDate)) {
      w.nextDate = Date.now(); cardModified = true;
    }
    if (w.meaningRep === undefined || w.meaningRep === null || isNaN(w.meaningRep)) {
      w.meaningRep = 0; cardModified = true;
    }
    if (w.meaningInterval === undefined || w.meaningInterval === null || isNaN(w.meaningInterval)) {
      w.meaningInterval = 0; cardModified = true;
    }
    if (w.meaningEf === undefined || w.meaningEf === null || isNaN(w.meaningEf) || w.meaningEf < 1.3) {
      w.meaningEf = 2.5; cardModified = true;
    }
    if (w.meaningNextDate === undefined || w.meaningNextDate === null || isNaN(w.meaningNextDate)) {
      w.meaningNextDate = Date.now(); cardModified = true;
    }

    if (!w.practiceType) {
      w.practiceType = 'spelling'; cardModified = true;
    }

    if (currentVersion < 3 && w.practiceType === 'both') {
      w.practiceType = 'spelling'; cardModified = true;
    }
    if (currentVersion < 4 && w.practiceType === 'meaning') {
      w.practiceType = 'recall'; cardModified = true;
    }

    if (currentVersion < 5 && !w.mastered) {
      const partOfSpeechLower = (w.partOfSpeech || '').toLowerCase();
      const isGrammaticalPattern = partOfSpeechLower.includes('grammatical pattern');
      const tokens = (w.word || '').trim().split(/\s+/).filter(Boolean);
      const wordCount = tokens.length;

      if (isGrammaticalPattern || wordCount > 3 || (wordCount > 1 && wordCount <= 3)) {
        if (w.practiceType !== 'recall') {
          w.practiceType = 'recall'; cardModified = true;
        }
      } else if (wordCount === 1) {
        if (w.practiceType !== 'spelling') {
          w.practiceType = 'spelling'; cardModified = true;
        }
      }
    }

    if (cardModified) modified = true;
    return w;
  });

  const filtered = sanitized.filter(w => {
    if (w && w.practiceType === 'syntax') {
      modified = true;
      return false;
    }
    return w !== null && w !== undefined;
  });

  if (modified) {
    await setStored('spelt_words', filtered);
  }

  await setStored('spelt_schema_version', CURRENT_SCHEMA_VERSION);
  return filtered;
}
