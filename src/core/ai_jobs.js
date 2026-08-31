export const AI_JOB_STORAGE_KEY = 'spelt_ai_job';

export const AI_JOB_KINDS = Object.freeze({
  ENRICH_SELECTED: 'enrich-selected',
  ENRICH_ALL: 'enrich-all'
});

export const AI_JOB_ACTIVE_STATES = new Set(['queued', 'running', 'cancelling']);

const SUPPORTED_LANGUAGES = new Set([
  'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar', 'fa', 'zh', 'ja', 'ko', 'tr'
]);

export function validateAiJobRequest(input, availableWordIds = null) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid AI job request.');
  }

  const kind = input.kind;
  if (!Object.values(AI_JOB_KINDS).includes(kind)) {
    throw new Error('Unsupported AI job type.');
  }

  const targetLang = String(input.targetLang || '').trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(targetLang)) {
    throw new Error('Select a supported translation language first.');
  }

  let wordIds = Array.isArray(input.wordIds)
    ? [...new Set(input.wordIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
    : [];

  if (availableWordIds) {
    const allowed = availableWordIds instanceof Set ? availableWordIds : new Set(availableWordIds);
    wordIds = wordIds.filter(id => allowed.has(id));
  }

  if (kind === AI_JOB_KINDS.ENRICH_SELECTED && wordIds.length === 0) {
    throw new Error('Choose at least one word to enrich.');
  }

  return { kind, targetLang, wordIds };
}

export function createAiJob({ id, kind, targetLang, wordIds, now = Date.now() }) {
  const uniqueIds = [...new Set(wordIds)];
  return {
    id,
    kind,
    targetLang,
    status: 'queued',
    wordIds: uniqueIds,
    cursor: 0,
    total: uniqueIds.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
    currentWord: '',
    cancelRequested: false,
    createdAt: now,
    startedAt: null,
    updatedAt: now,
    finishedAt: null
  };
}

export function recordAiJobResult(job, { wordId, word = '', error = null, now = Date.now() }) {
  const next = { ...job };
  next.cursor = Math.min(next.total, next.cursor + 1);
  next.completed = Math.min(next.total, next.completed + 1);
  next.currentWord = word;
  next.updatedAt = now;

  if (error) {
    next.failed += 1;
    next.failures = [...(next.failures || []), {
      wordId,
      word,
      message: String(error).slice(0, 240)
    }].slice(-20);
  } else {
    next.succeeded += 1;
  }

  return next;
}

export function finishAiJob(job, status, now = Date.now()) {
  if (!['completed', 'cancelled', 'failed'].includes(status)) {
    throw new Error('Invalid terminal AI job status.');
  }
  return {
    ...job,
    status,
    currentWord: '',
    updatedAt: now,
    finishedAt: now
  };
}

export function getAiJobPercent(job) {
  if (!job || !Number.isFinite(job.total) || job.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((job.completed / job.total) * 100)));
}

export function toPublicAiJob(job) {
  if (!job) return null;
  const publicJob = { ...job };
  delete publicJob.wordIds;
  return {
    ...publicJob,
    percent: getAiJobPercent(job),
    failures: Array.isArray(job.failures) ? job.failures : []
  };
}
