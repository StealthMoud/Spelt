import { getWords, askGemini, atomicUpdate, isGeminiConfigured } from '../shared/storage.js';
import { getLanguageName } from '../src/core/languages.js';
import {
  AI_JOB_ACTIVE_STATES,
  AI_JOB_KINDS,
  AI_JOB_STORAGE_KEY,
  createAiJob,
  finishAiJob,
  recordAiJobResult,
  toPublicAiJob,
  validateAiJobRequest
} from '../src/core/ai_jobs.js';
import { buildEnrichmentPrompt } from '../shared/ai/prompts.js';

const RECOVERY_ALARM = 'spelt-ai-job-recovery';
const AI_JOB_WRITE_LOCK = 'spelt_ai_job_write';
let runningJobId = null;

function withAiJobWriteLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(AI_JOB_WRITE_LOCK, task);
  }
  return task();
}

function getLocal(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, result => resolve(result || {})));
}

function setLocal(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function readJob() {
  const result = await getLocal(AI_JOB_STORAGE_KEY);
  return result[AI_JOB_STORAGE_KEY] || null;
}

async function broadcastJob(job) {
  const message = { action: 'aiJobProgress', job: toPublicAiJob(job) };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // The popup is commonly closed while a background job is running.
  }
}

async function writeJob(job, { expectedId = null, rejectIfActive = false } = {}) {
  const written = await withAiJobWriteLock(async () => {
    const current = await readJob();
    if (expectedId && current?.id !== expectedId) return false;
    if (rejectIfActive && current && AI_JOB_ACTIVE_STATES.has(current.status)) {
      throw new Error('Another AI enrichment job is already running.');
    }
    await setLocal({ [AI_JOB_STORAGE_KEY]: job });
    return true;
  });
  if (written) await broadcastJob(job);
  return written;
}

function scheduleRecovery() {
  chrome.alarms?.create(RECOVERY_ALARM, { delayInMinutes: 0.5 });
}

function clearRecovery() {
  chrome.alarms?.clear(RECOVERY_ALARM);
}

async function enrichWord(wordId, targetLang) {
  const words = await getWords();
  const card = words.find(word => word.id === wordId);
  if (!card) throw new Error('Word no longer exists.');

  const prompt = buildEnrichmentPrompt(card.word, card, getLanguageName(targetLang));
  const aiData = await askGemini(prompt);

  await atomicUpdate(async freshWords => {
    const target = freshWords.find(word => word.id === wordId);
    if (!target) throw new Error('Word was removed while enrichment was running.');

    if (aiData.definition) target.definition = aiData.definition;
    if (aiData.transcription) target.transcription = aiData.transcription;
    if (aiData.partOfSpeech) target.partOfSpeech = aiData.partOfSpeech;
    if (aiData.translation) target.translation = aiData.translation;
    if (aiData.level) {
      target.level = aiData.level.toUpperCase().trim();
      target.otherLevels = [];
    }
    if (aiData.example && target.example !== aiData.example) {
      target.example = aiData.example;
      target.exampleTranslation = '';
    }
  });

  return card.word;
}

export async function startAiJob(request) {
  const [settings, words] = await Promise.all([
    getLocal(['spelt_allow_background_ai']),
    getWords()
  ]);

  if (!settings.spelt_allow_background_ai) {
    throw new Error('Enable background AI processing in Settings first.');
  }
  if (!(await isGeminiConfigured())) {
    throw new Error('Connect a Gemini API key in Settings first.');
  }
  const availableIds = new Set(words.map(word => word.id));
  const normalized = validateAiJobRequest(request, availableIds);
  if (normalized.kind === AI_JOB_KINDS.ENRICH_ALL) {
    normalized.wordIds = words.map(word => word.id);
  }
  if (normalized.wordIds.length === 0) {
    throw new Error('There are no words to enrich.');
  }

  const job = createAiJob({
    id: crypto.randomUUID(),
    ...normalized
  });
  await writeJob(job, { rejectIfActive: true });
  scheduleRecovery();
  runAiJob(job.id).catch(error => failJob(job.id, error));
  return toPublicAiJob(job);
}

export async function cancelAiJob(jobId) {
  const job = await readJob();
  if (!job || job.id !== jobId) throw new Error('AI job not found.');
  if (!AI_JOB_ACTIVE_STATES.has(job.status)) return toPublicAiJob(job);

  job.cancelRequested = true;
  job.status = 'cancelling';
  job.updatedAt = Date.now();
  const written = await writeJob(job, { expectedId: jobId });
  if (!written) throw new Error('AI job not found.');
  return toPublicAiJob(job);
}

export async function getAiJobStatus() {
  return toPublicAiJob(await readJob());
}

export async function resumeAiJob() {
  const job = await readJob();
  if (!job || !AI_JOB_ACTIVE_STATES.has(job.status)) return;
  await runAiJob(job.id);
}

async function runAiJob(jobId) {
  if (runningJobId === jobId) return;
  runningJobId = jobId;

  try {
    let job = await readJob();
    if (!job || job.id !== jobId || !AI_JOB_ACTIVE_STATES.has(job.status)) return;

    if (!job.startedAt) job.startedAt = Date.now();
    job.status = job.cancelRequested ? 'cancelling' : 'running';
    job.updatedAt = Date.now();
    if (!(await writeJob(job, { expectedId: jobId }))) return;

    while (job.cursor < job.total) {
      const persisted = await readJob();
      if (!persisted || persisted.id !== jobId) return;
      job = persisted;

      if (job.cancelRequested) {
        await writeJob(finishAiJob(job, 'cancelled'), { expectedId: jobId });
        clearRecovery();
        return;
      }

      const wordId = job.wordIds[job.cursor];
      let word = '';
      let error = null;
      try {
        word = await enrichWord(wordId, job.targetLang);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const latest = await readJob();
      if (!latest || latest.id !== jobId) return;
      job = latest;
      job = recordAiJobResult(job, { wordId, word, error });
      if (!(await writeJob(job, { expectedId: jobId }))) return;
      scheduleRecovery();
    }

    await writeJob(finishAiJob(job, 'completed'), { expectedId: jobId });
    clearRecovery();
  } finally {
    runningJobId = null;
  }
}

async function failJob(jobId, error) {
  const job = await readJob();
  if (!job || job.id !== jobId || !AI_JOB_ACTIVE_STATES.has(job.status)) return;
  job.failures = [...(job.failures || []), {
    wordId: '',
    word: '',
    message: error instanceof Error ? error.message : String(error)
  }].slice(-20);
  await writeJob(finishAiJob(job, 'failed'), { expectedId: jobId });
  clearRecovery();
}

export function registerAiJobRecovery() {
  chrome.alarms?.onAlarm.addListener(alarm => {
    if (alarm.name === RECOVERY_ALARM) {
      resumeAiJob().catch(error => console.error('AI job recovery failed:', error));
    }
  });
  resumeAiJob().catch(error => console.error('AI job resume failed:', error));
}
