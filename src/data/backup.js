const MAX_WORD_LENGTH = 160;
const MAX_FIELD_LENGTH = 2000;
const MAX_HISTORY_ENTRIES = 500;
const MAX_MISSPELLINGS = 100;
const MAX_ACTIVITY_DAYS = 5000;
const MAX_SESSIONS = 200;
const PRACTICE_TYPES = new Set(['spelling', 'recall', 'both']);
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value, maxLength = MAX_FIELD_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function finiteNumber(value, fallback, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizePracticeType(value, override) {
  if (PRACTICE_TYPES.has(override)) return override;
  const normalized = value === 'syntax' ? 'recall' : value;
  return PRACTICE_TYPES.has(normalized) ? normalized : 'both';
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY_ENTRIES).flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const date = finiteNumber(entry.date, 0, { min: 0 });
    const q = finiteNumber(entry.q, 0, { min: 0, max: 5 });
    if (!date) return [];
    const normalized = {
      date,
      q,
      interval: finiteNumber(entry.interval, 0, { min: 0 }),
      mode: entry.mode === 'meaning' || entry.mode === 'recall' ? 'meaning' : 'spelling'
    };
    const responseTime = finiteNumber(entry.rt, 0, { min: 0, max: 60 * 60 * 1000 });
    if (responseTime > 0) normalized.rt = responseTime;
    return [normalized];
  });
}

export function normalizeImportedWord(item, {
  practiceTypeOverride = null,
  now = Date.now(),
  idFactory = () => crypto.randomUUID()
} = {}) {
  if (!item || typeof item !== 'object') return null;
  const word = text(item.word, MAX_WORD_LENGTH);
  if (!word) return null;

  const id = text(item.id, 160) || `word_${idFactory()}`;
  const misspellings = Array.isArray(item.misspellings)
    ? item.misspellings.map(value => text(value, MAX_WORD_LENGTH)).filter(Boolean).slice(-MAX_MISSPELLINGS)
    : [];

  return {
    id,
    word,
    definition: text(item.definition),
    translation: text(item.translation),
    transcription: text(item.transcription, 240),
    partOfSpeech: text(item.partOfSpeech, 120),
    example: text(item.example),
    exampleTranslation: text(item.exampleTranslation),
    level: text(item.level, 40).toUpperCase(),
    otherLevels: Array.isArray(item.otherLevels)
      ? item.otherLevels.map(value => text(value, 40).toUpperCase()).filter(Boolean).slice(0, 12)
      : [],
    practiceType: normalizePracticeType(item.practiceType, practiceTypeOverride),
    mastered: item.mastered === true,
    createdAt: finiteNumber(item.createdAt, now, { min: 0 }),
    masteredAt: finiteNumber(item.masteredAt, 0, { min: 0 }) || undefined,

    rep: finiteNumber(item.rep, 0, { min: 0, max: 100000 }),
    interval: finiteNumber(item.interval, 0, { min: 0, max: 36500 }),
    ef: finiteNumber(item.ef, 2.5, { min: 1.3, max: 3 }),
    nextDate: finiteNumber(item.nextDate, now, { min: 0 }),
    misspellings,
    totalErrors: finiteNumber(item.totalErrors, misspellings.length, { min: 0, max: 1000000 }),
    correctStreak: finiteNumber(item.correctStreak, 0, { min: 0, max: 1000000 }),

    meaningRep: finiteNumber(item.meaningRep, 0, { min: 0, max: 100000 }),
    meaningInterval: finiteNumber(item.meaningInterval, 0, { min: 0, max: 36500 }),
    meaningEf: finiteNumber(item.meaningEf, 2.5, { min: 1.3, max: 3 }),
    meaningNextDate: finiteNumber(item.meaningNextDate, now, { min: 0 }),
    history: normalizeHistory(item.history)
  };
}

export function validateBackupShape(parsed, { maxWords = 10000 } = {}) {
  const isFullBackup = !!parsed && !Array.isArray(parsed) && Array.isArray(parsed.words);
  const words = Array.isArray(parsed) ? parsed : isFullBackup ? parsed.words : null;
  if (!words) throw new Error('This file is not a Spelt backup.');
  if (words.length > maxWords) {
    throw new Error(`This backup contains more than ${maxWords.toLocaleString()} words.`);
  }
  return { isFullBackup, words };
}

function normalizeDailyCounts(value, fields = null) {
  if (!isPlainObject(value)) return null;
  const result = {};
  Object.entries(value).slice(-MAX_ACTIVITY_DAYS).forEach(([date, entry]) => {
    if (!DATE_KEY_PATTERN.test(date)) return;
    if (!fields) {
      result[date] = finiteNumber(entry, 0, { min: 0, max: 10000000 });
      return;
    }
    if (!isPlainObject(entry)) return;
    result[date] = Object.fromEntries(fields.map(field => [
      field,
      finiteNumber(entry[field], 0, { min: 0, max: 10000000 })
    ]));
  });
  return result;
}

function normalizeSessions(value) {
  if (!Array.isArray(value)) return null;
  return value.slice(-MAX_SESSIONS).flatMap(session => {
    if (!isPlainObject(session)) return [];
    const startTime = finiteNumber(session.startTime, 0, { min: 0 });
    const endTime = finiteNumber(session.endTime, 0, { min: startTime });
    if (!startTime || !endTime) return [];
    return [{
      startTime,
      endTime,
      reviewCount: finiteNumber(session.reviewCount, 0, { min: 0, max: 1000000 }),
      correctCount: finiteNumber(session.correctCount, 0, { min: 0, max: 1000000 })
    }];
  });
}

export function normalizeBackupMetadata(parsed) {
  if (!isPlainObject(parsed)) {
    return { activity: null, streak: null, sessions: null, sandboxActivity: null };
  }

  const streak = isPlainObject(parsed.streak) ? {
    current: finiteNumber(parsed.streak.current, 0, { min: 0, max: 100000 }),
    max: finiteNumber(parsed.streak.max, 0, { min: 0, max: 100000 }),
    lastDate: DATE_KEY_PATTERN.test(parsed.streak.lastDate || '') ? parsed.streak.lastDate : ''
  } : null;

  return {
    activity: normalizeDailyCounts(parsed.activity),
    streak,
    sessions: normalizeSessions(parsed.sessions),
    sandboxActivity: normalizeDailyCounts(parsed.sandbox_activity, ['checks', 'correct', 'misspelled', 'notFound'])
  };
}
