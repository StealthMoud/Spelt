import { getStored, setStored } from './storage.js';
import { getGeminiKeyFingerprint, collectModelsFromKeyMap } from '../../shared/storage/gemini.js';

export function parseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return asNum;
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return asDate;
  }
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && typeof value.getTime === 'function') {
    const ts = value.getTime();
    if (Number.isFinite(ts)) return ts;
  }
  return null;
}

export function inferPracticeType(card) {
  const tokenCount = String(card?.word || '').trim().split(/\s+/).filter(Boolean).length;
  if (tokenCount > 1) return 'recall';
  return 'spelling';
}

export function makeCardId() {
  return `word_repaired_${crypto.randomUUID()}`;
}

export function summarizeIssueBuckets(issues) {
  const sorted = [...issues.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 4).map(([name, count]) => `${name} (${count})`);
}

export async function runIntegrityAudit({ repair = false } = {}) {
  const issueBuckets = new Map();
  let issueCount = 0;
  let fixedCount = 0;

  const bump = (bucket, fixed = false) => {
    issueCount += 1;
    issueBuckets.set(bucket, (issueBuckets.get(bucket) || 0) + 1);
    if (fixed) fixedCount += 1;
  };

  const rawWords = await getStored('spelt_words');
  const sourceWords = Array.isArray(rawWords) ? rawWords : [];

  if (!Array.isArray(rawWords)) {
    bump('Words root not array', repair);
  }

  const seenIds = new Set();
  const repairedWords = [];
  const allowedPracticeTypes = new Set(['spelling', 'recall', 'both']);
  const allowedLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

  sourceWords.forEach((item, _idx) => {
    if (!item || typeof item !== 'object') {
      bump('Invalid word record', repair);
      if (!repair) repairedWords.push(item);
      return;
    }

    const card = { ...item };

    if (typeof card.word !== 'string' || card.word.trim() === '') {
      bump('Missing word text', repair);
      if (!repair) repairedWords.push(card);
      return;
    }
    card.word = card.word.trim();

    if (typeof card.id !== 'string' || card.id.trim() === '') {
      bump('Missing card id', repair);
      if (repair) card.id = makeCardId();
    } else {
      card.id = card.id.trim();
    }

    if (seenIds.has(card.id)) {
      bump('Duplicate card id', repair);
      if (repair) {
        card.id = makeCardId();
      }
    }
    seenIds.add(card.id);

    if (!allowedPracticeTypes.has(card.practiceType)) {
      bump('Invalid practice type', repair);
      if (repair) card.practiceType = inferPracticeType(card);
    }

    const nextTs = parseTimestamp(card.nextDate);
    if (!Number.isFinite(nextTs)) {
      bump('Invalid nextDate', repair);
      if (repair) card.nextDate = Date.now();
    } else if (repair) {
      card.nextDate = nextTs;
    }

    const meaningNextTs = parseTimestamp(card.meaningNextDate);
    if (!Number.isFinite(meaningNextTs)) {
      bump('Invalid meaningNextDate', repair);
      if (repair) card.meaningNextDate = Date.now();
    } else if (repair) {
      card.meaningNextDate = meaningNextTs;
    }

    if (!Number.isFinite(Number(card.ef)) || Number(card.ef) < 1.3) {
      bump('Invalid ef', repair);
      if (repair) card.ef = 2.5;
    }
    if (!Number.isFinite(Number(card.meaningEf)) || Number(card.meaningEf) < 1.3) {
      bump('Invalid meaningEf', repair);
      if (repair) card.meaningEf = 2.5;
    }

    if (!Array.isArray(card.misspellings)) {
      bump('Invalid misspellings list', repair);
      if (repair) card.misspellings = [];
    }
    if (!Array.isArray(card.otherLevels)) {
      bump('Invalid otherLevels list', repair);
      if (repair) card.otherLevels = [];
    }
    if (card.history !== undefined && !Array.isArray(card.history)) {
      bump('Invalid history list', repair);
      if (repair) card.history = [];
    }

    if (typeof card.level === 'string' && card.level.trim()) {
      const upper = card.level.trim().toUpperCase();
      if (!allowedLevels.has(upper)) {
        bump('Invalid CEFR level', repair);
        if (repair) card.level = '';
      } else if (repair) {
        card.level = upper;
      }
    }

    repairedWords.push(card);
  });

  const activity = await getStored('spelt_activity');
  if (activity !== undefined && (typeof activity !== 'object' || Array.isArray(activity) || activity === null)) {
    bump('Invalid activity object', repair);
    if (repair) await setStored('spelt_activity', {});
  }

  const streak = await getStored('spelt_streak');
  const streakValid = streak && typeof streak === 'object' && !Array.isArray(streak);
  if (!streakValid) {
    bump('Invalid streak object', repair);
    if (repair) await setStored('spelt_streak', { current: 0, lastDate: '', max: 0 });
  } else if (repair) {
    const normalizedStreak = {
      current: Number.isFinite(Number(streak.current)) ? Number(streak.current) : 0,
      lastDate: typeof streak.lastDate === 'string' ? streak.lastDate : '',
      max: Number.isFinite(Number(streak.max)) ? Number(streak.max) : 0
    };
    await setStored('spelt_streak', normalizedStreak);
  }

  const sessions = await getStored('spelt_sessions');
  if (sessions !== undefined && !Array.isArray(sessions)) {
    bump('Invalid sessions list', repair);
    if (repair) await setStored('spelt_sessions', []);
  }

  const sandbox = await getStored('spelt_sandbox_activity');
  if (sandbox !== undefined && (typeof sandbox !== 'object' || Array.isArray(sandbox) || sandbox === null)) {
    bump('Invalid sandbox activity object', repair);
    if (repair) await setStored('spelt_sandbox_activity', {});
  }

  const geminiKeysRaw = await getStored('spelt_gemini_keys');
  const legacyKey = await getStored('spelt_gemini_key');
  const keyModelsRaw = await getStored('spelt_gemini_key_models');
  const keyModels = keyModelsRaw && typeof keyModelsRaw === 'object' && !Array.isArray(keyModelsRaw)
    ? { ...keyModelsRaw }
    : {};

  const keys = Array.isArray(geminiKeysRaw) ? geminiKeysRaw.filter(Boolean) : (legacyKey ? [legacyKey] : []);
  const fingerprints = new Set(keys.map(k => getGeminiKeyFingerprint(k)));
  let mapChanged = false;

  Object.keys(keyModels).forEach(fp => {
    if (!fingerprints.has(fp)) {
      bump('Orphan Gemini key-model mapping', repair);
      if (repair) {
        delete keyModels[fp];
        mapChanged = true;
      }
    } else if (!Array.isArray(keyModels[fp])) {
      bump('Invalid Gemini model list', repair);
      if (repair) {
        keyModels[fp] = [];
        mapChanged = true;
      }
    }
  });

  if (repair) {
    await setStored('spelt_words', repairedWords);
    if (mapChanged) {
      await setStored('spelt_gemini_key_models', keyModels);
      await setStored('spelt_gemini_models_list', collectModelsFromKeyMap(keyModels, keys));
    }
  }

  return {
    issueCount,
    fixedCount,
    topCategories: summarizeIssueBuckets(issueBuckets)
  };
}
