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
    window.lookupMode = 'fallback';
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return original(input, init);
      if (url.includes('dictionaryapi.dev')) throw new DOMException('signal timed out', 'TimeoutError');
      if (window.lookupMode === 'offline') throw new TypeError('Failed to fetch');
      if (url.includes('dictionary.cambridge.org')) return new Response('<div class="def ddef_d">a clear dictionary definition</div>', { status: 200 });
      return new Response('{}', { status: 404 });
    };
  });
  await page.goto(worker.url().replace(/\/background\.js$/, '/dist/popup.html#popout'));
  await page.locator('#sandbox-tab-button').click();
  async function lookup(word) {
    await page.locator('#word-input').fill(word);
    await page.locator('#verify-word-btn').click();
    await page.waitForFunction(() => document.getElementById('feedback-msg').getAttribute('aria-busy') === 'false');
  }
  await lookup('spelling');
  assert.match(await page.locator('#feedback-msg').innerText(), /a clear dictionary definition/);
  console.log('PASS primary timeout falls back to secondary definition');
  await page.evaluate(() => { window.lookupMode = 'offline'; });
  await lookup('learning');
  assert.match(await page.locator('#feedback-msg').innerText(), /dictionaries aren’t responding/);
  assert.equal(await page.locator('#word-input').inputValue(), 'learning');
  assert.equal(await page.locator('#word-input').evaluate(el => el.readOnly), false);
  assert.equal(await page.locator('#verify-word-btn').isEnabled(), true);
  console.log('PASS outage preserves query and restores editable controls');
  await page.evaluate(() => { window.lookupMode = 'fallback'; });
  await page.locator('#verify-word-btn').click();
  await page.waitForFunction(() => document.getElementById('feedback-msg').textContent.includes('a clear dictionary definition'));
  assert.deepEqual(errors, []);
  console.log('PASS retry recovers after failed secondary responses');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
