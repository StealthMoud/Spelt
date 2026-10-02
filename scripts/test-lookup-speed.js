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
    let release;
    const optional = new Promise(resolve => { release = resolve; });
    window.releaseDetails = release;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return original(input, init);
      if (url.includes('dictionaryapi.dev')) return new Response(JSON.stringify([{ phonetics: [], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'an immediate primary meaning' }] }] }]), { status: 200 });
      await optional;
      if (url.includes('translate.googleapis.com')) return new Response(JSON.stringify([[['ترجمه']]]), { status: 200 });
      if (url.includes('oxfordlearnersdictionaries')) return new Response('<span class="cefr">B2</span>', { status: 200 });
      return new Response('{}', { status: 404 });
    };
  });
  await page.goto(worker.url().replace(/\/background\.js$/, '/dist/popup.html#popout'));
  await page.evaluate(() => chrome.storage.local.set({ spelt_target_lang: 'fa' }));
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#word-input').fill('learning');
  const started = Date.now();
  await page.locator('#verify-word-btn').click();
  await page.locator('#feedback-def-display').waitFor({ timeout: 1500 });
  assert.match(await page.locator('#feedback-def-display').innerText(), /an immediate primary meaning/);
  assert.equal(await page.locator('#verify-word-btn').isEnabled(), true);
  console.log(`PASS meaning and controls ready in ${Date.now() - started}ms while optional providers remain blocked`);
  await page.evaluate(() => window.releaseDetails());
  await page.locator('#feedback-trans-badge').waitFor();
  assert.equal(await page.locator('#feedback-level-badge').innerText(), 'B2');
  assert.equal(await page.locator('#sandbox-primary-add-btn').getAttribute('data-translation'), 'ترجمه');
  assert.match(await page.locator('#feedback-def-display').innerText(), /an immediate primary meaning/);
  assert.deepEqual(errors, []);
  console.log('PASS optional metadata arrives later and updates Add without replacing the meaning');

} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
