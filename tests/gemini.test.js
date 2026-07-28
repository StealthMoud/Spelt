import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Request-engine tests for shared/storage/gemini.js.
 *
 * chrome.storage and fetch are stubbed so the trial routing can be asserted
 * directly: which model and which key each attempt goes to, what a failure
 * rules out, and whether a slow key blocks the answer.
 */

const KEYS = ['AAAAkey-one-1111', 'AAAAkey-two-2222', 'AAAAkey-three-3333'];

const store = {};
const calls = [];
let plan = () => ({ status: 200, text: 'ok' });

function resetStore() {
  Object.assign(store, {
    spelt_gemini_keys: [...KEYS],
    spelt_gemini_model: 'auto',
    spelt_gemini_models_list: ['models/gemini-3.5-flash', 'models/gemini-2.5-flash'],
    spelt_gemini_key_models: {},
    spelt_bad_models: [],
    spelt_bad_models_epoch: 2,
    spelt_rate_limit_cooldowns: {}
  });
}

globalThis.chrome = {
  storage: {
    local: {
      get(fields, cb) {
        const wanted = Array.isArray(fields) ? fields : [fields];
        const out = {};
        for (const field of wanted) if (field in store) out[field] = store[field];
        cb?.(out);
      },
      set(values, cb) { Object.assign(store, values); cb?.(); }
    },
    onChanged: { addListener() {} }
  }
};

function sseFrame(text) {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

globalThis.fetch = async (url, opts) => {
  const record = {
    model: url.match(/models\/([^:]+)/)[1],
    key: opts.headers['x-goog-api-key'].slice(-4),
    stream: url.includes('streamGenerateContent'),
    aborted: false
  };
  calls.push(record);

  const outcome = plan(record, JSON.parse(opts.body));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, outcome.delay || 0);
    opts.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      record.aborted = true;
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    }, { once: true });
  });

  if (outcome.status !== 200) {
    return {
      ok: false,
      status: outcome.status,
      json: async () => ({ error: { message: outcome.message || '' } })
    };
  }

  if (record.stream) {
    const bytes = new TextEncoder().encode(sseFrame(outcome.text));
    let sent = false;
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => (sent ? { done: true } : (sent = true, { done: false, value: bytes })),
          cancel: async () => {}
        })
      }
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: outcome.text }] } }] })
  };
};

/**
 * A fresh module instance per test. The engine deliberately keeps cooldowns,
 * the blacklist and the unsupported-field map in memory, so a shared instance
 * would let one test's verdicts decide the next test's routing.
 */
const MODULE = new URL('../shared/storage/gemini.js', import.meta.url).href;
let instance = 0;

async function freshEngine() {
  // The engine persists cooldowns on a debounce, so the previous instance may
  // still have a write in flight. Let it land before wiping the shared store,
  // otherwise it reappears mid-test and looks like this test's doing.
  await new Promise(r => setTimeout(r, 300));
  resetStore();
  calls.length = 0;
  return import(`${MODULE}?i=${instance++}`);
}

test('a successful request costs exactly one API call', async () => {
  const gemini = await freshEngine();
  plan = () => ({ status: 200, text: 'hello' });

  assert.equal(await gemini.askGeminiText('hi'), 'hello');
  assert.equal(calls.length, 1);
});

test('thinking is off unless the caller asks for it', async () => {
  const gemini = await freshEngine();
  let body = null;
  plan = (_record, sent) => { body = sent; return { status: 200, text: 'x' }; };

  await gemini.askGeminiText('hi');
  assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingBudget: 0 });

  await gemini.askGeminiText('hi', { thinking: true });
  assert.equal(body.generationConfig.thinkingConfig, undefined);
});

test('a model the account cannot serve is not retried on every key', async () => {
  const gemini = await freshEngine();
  plan = (record) => record.model === 'gemini-3.5-flash'
    ? { status: 404, message: 'model is not found' }
    : { status: 200, text: 'fallback' };

  assert.equal(await gemini.askGeminiText('hi'), 'fallback');
  const wasted = calls.filter(c => c.model === 'gemini-3.5-flash');
  assert.equal(wasted.length, 1, `dead model was tried ${wasted.length} times`);
});

test('an exhausted key falls through to the next key on the same model', async () => {
  const gemini = await freshEngine();
  plan = (record) => record.key === '1111'
    ? { status: 429, message: 'quota exceeded, retry in 30s' }
    : { status: 200, text: 'second key' };

  assert.equal(await gemini.askGeminiText('hi'), 'second key');
  assert.equal(calls[0].key, '1111');
  assert.equal(calls[1].key, '2222');
  assert.equal(calls[1].model, 'gemini-3.5-flash', 'should not drop a tier over a key problem');
});

test('a slow key is hedged rather than waited out, and is not penalised', async () => {
  const gemini = await freshEngine();
  plan = (record) => record.key === '1111'
    ? { status: 200, delay: 60000, text: 'slow' }
    : { status: 200, delay: 50, text: 'fast' };

  const started = Date.now();
  assert.equal(await gemini.askGeminiText('hi'), 'fast');
  assert.ok(Date.now() - started < 4000, 'hedge did not fire');
  assert.ok(calls.find(c => c.key === '1111').aborted, 'losing attempt was left running');

  await new Promise(r => setTimeout(r, 400)); // let the debounced persist land
  assert.deepEqual(store.spelt_rate_limit_cooldowns, {}, 'the hedge loser was penalised');
});

test('a generationConfig field the model rejects is retried in place, then remembered', async () => {
  const gemini = await freshEngine();
  let rejecting = true;
  plan = (_record, body) => (rejecting && body.generationConfig?.thinkingConfig)
    ? { status: 400, message: 'Unknown name "thinkingConfig"' }
    : { status: 200, text: 'recovered' };

  assert.equal(await gemini.askGeminiText('hi'), 'recovered');
  assert.equal(calls.length, 2, 'should retry the same model rather than drop a tier');
  assert.equal(calls[1].model, calls[0].model);

  rejecting = false;
  calls.length = 0;
  await gemini.askGeminiText('again');
  assert.equal(calls.length, 1, 'rediscovered a field already known to be unsupported');
});

test('streaming emits only the winning attempt text', async () => {
  const gemini = await freshEngine();
  plan = (record) => record.key === '1111'
    ? { status: 200, delay: 60000, text: 'slow text' }
    : { status: 200, delay: 50, text: 'fast text' };

  const chunks = [];
  assert.equal(await gemini.askGeminiTextStream('hi', {}, t => chunks.push(t)), 'fast text');
  assert.deepEqual(chunks, ['fast text'], 'hedged attempts interleaved into the callback');
});

test('exhausting every model and key reports how long to wait', async () => {
  const gemini = await freshEngine();
  plan = () => ({ status: 429, message: 'quota exceeded. retry in 12s' });

  await assert.rejects(() => gemini.askGeminiText('hi'), /rate-limited.*retry in ~1[0-9]s/);
});

test('concurrent requests are not serialised behind each other', async () => {
  const gemini = await freshEngine();
  plan = () => ({ status: 200, delay: 300, text: 'x' });

  const started = Date.now();
  await Promise.all([1, 2, 3].map(() => gemini.askGeminiText('hi')));
  assert.ok(Date.now() - started < 700, 'requests still run one at a time');
});
