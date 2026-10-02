import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(path.join(os.tmpdir(), 'spelt-selection-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 580, height: 850 },
    ...(process.env.SPELT_CHROMIUM_PATH ? { executablePath: process.env.SPELT_CHROMIUM_PATH } : {}),
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.aiCalls = 0;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return original(input, init);
      if (url.includes('generativelanguage.googleapis.com')) {
        window.aiCalls++;
        const entry = { word: 'academic drive', definition: 'A strong motivation to learn and succeed in your studies.', transcription: '/ˌækəˈdemɪk draɪv/', partOfSpeech: 'noun phrase', translation: 'انگیزه تحصیلی', level: 'B2', example: 'Her academic drive helped her finish the course.' };
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(window.aiEmpty ? {} : entry) }] } }] }), { status: 200 });
      }
      if (url.includes('dictionaryapi.dev')) throw new DOMException('signal timed out', 'TimeoutError');
      return new Response('{}', { status: 404 });
    };
  });
  await page.goto(worker.url().replace(/\/background\.js$/, '/dist/popup.html#popout'));
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#word-input').fill('academic drive');
  await page.locator('#verify-word-btn').click();
  await page.locator('.sandbox-ai-explain-btn').waitFor();
  assert.equal(await page.locator('.sandbox-ai-explain-btn').innerText(), 'Set up AI');
  await page.locator('.sandbox-ai-explain-btn').click();
  await page.locator('#settings-tab.active').waitFor();
  assert.equal(await page.evaluate(() => window.aiCalls), 0);
  console.log('PASS unconfigured AI leads to Settings without making a request');
  await page.evaluate(() => chrome.storage.local.set({ spelt_gemini_keys: ['AAAAkey-test-1111'], spelt_gemini_model: 'auto', spelt_gemini_models_list: ['models/gemini-2.5-flash'], spelt_gemini_key_models: {}, spelt_bad_models: [], spelt_bad_models_epoch: 3 }));
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#verify-word-btn').click();
  await page.locator('.sandbox-ai-explain-btn').waitFor();
  await page.waitForFunction(() => document.querySelector('.sandbox-ai-explain-btn')?.textContent === 'Explain with AI');
  assert.equal(await page.evaluate(() => window.aiCalls), 0);
  await page.evaluate(() => { window.aiEmpty = true; });
  await page.locator('.sandbox-ai-explain-btn').click();
  await page.locator('.sandbox-ai-error:not(.hidden)').waitFor();
  assert.equal(await page.locator('#word-input').inputValue(), 'academic drive');
  assert.equal(await page.locator('.sandbox-ai-explain-btn').isEnabled(), true);
  console.log('PASS unusable AI reply keeps the phrase and offers retry');
  await page.evaluate(() => { window.aiEmpty = false; });
  await page.locator('.sandbox-ai-explain-btn').click();
  await page.waitForFunction(() => document.getElementById('feedback-def-display')?.textContent.includes('A strong motivation'));
  assert.equal(await page.locator('.feedback-title-success').innerText(), 'AI explanation');
  assert.equal(await page.locator('#sandbox-primary-add-btn').getAttribute('data-word'), 'academic drive');
  assert.equal(await page.locator('#sandbox-primary-add-btn').getAttribute('data-example'), 'Her academic drive helped her finish the course.');
  await page.locator('#sandbox-primary-add-btn').click();
  await page.locator('.sandbox-success-banner').waitFor();
  const saved = await page.evaluate(async () => (await import('../shared/storage.js')).getWords());
  assert.ok(saved.some(word => word.word === 'academic drive' && word.definition.includes('A strong motivation')));
  assert.deepEqual(errors, []);
  console.log('PASS explicit AI explanation preserves the full phrase, shows an example and saves to vault');

} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
