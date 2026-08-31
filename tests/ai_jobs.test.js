import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_JOB_KINDS,
  createAiJob,
  finishAiJob,
  getAiJobPercent,
  recordAiJobResult,
  toPublicAiJob,
  validateAiJobRequest
} from '../src/core/ai_jobs.js';

test('AI job requests are normalized and limited to existing words', () => {
  const request = validateAiJobRequest({
    kind: AI_JOB_KINDS.ENRICH_SELECTED,
    targetLang: ' IT ',
    wordIds: ['one', 'missing', 'one', '', 42]
  }, new Set(['one', 'two']));

  assert.deepEqual(request, {
    kind: AI_JOB_KINDS.ENRICH_SELECTED,
    targetLang: 'it',
    wordIds: ['one']
  });
});

test('AI job requests reject unsupported languages and empty selections', () => {
  assert.throws(() => validateAiJobRequest({
    kind: AI_JOB_KINDS.ENRICH_SELECTED,
    targetLang: 'xx',
    wordIds: ['one']
  }), /supported translation language/);

  assert.throws(() => validateAiJobRequest({
    kind: AI_JOB_KINDS.ENRICH_SELECTED,
    targetLang: 'fa',
    wordIds: []
  }), /at least one word/);
});

test('AI job progress is deterministic and hides the internal queue', () => {
  let job = createAiJob({
    id: 'job-1',
    kind: AI_JOB_KINDS.ENRICH_SELECTED,
    targetLang: 'fa',
    wordIds: ['one', 'two'],
    now: 100
  });

  job = recordAiJobResult(job, { wordId: 'one', word: 'one', now: 200 });
  job = recordAiJobResult(job, { wordId: 'two', word: 'two', error: 'quota', now: 300 });

  assert.equal(getAiJobPercent(job), 100);
  assert.equal(job.succeeded, 1);
  assert.equal(job.failed, 1);

  const completed = finishAiJob(job, 'completed', 400);
  const publicJob = toPublicAiJob(completed);
  assert.equal(publicJob.status, 'completed');
  assert.equal(publicJob.percent, 100);
  assert.equal('wordIds' in publicJob, false);
  assert.deepEqual(publicJob.failures, [{ wordId: 'two', word: 'two', message: 'quota' }]);
});
