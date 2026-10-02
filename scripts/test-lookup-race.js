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
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return original(input, init);
      if (url.includes('oxfordlearnersdictionaries') && !window.offline) return new Response('<span class="def">a fast Oxford meaning</span>', { status: 200 });
      // Hold both other dictionaries indefinitely to prove Oxford is independent.
      return new Promise(() => {});
    };
  });
  const popup = worker.url().replace(/\/background\.js$/, '/dist/popup.html#popout');
  await page.goto(popup);
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#word-input').fill('learning');
  const started = Date.now();
  await page.locator('#verify-word-btn').click();
  await page.locator('#feedback-def-display').waitFor({ timeout: 1000 });
  assert.match(await page.locator('#feedback-def-display').innerText(), /a fast Oxford meaning/);
  console.log(`PASS Oxford meaning ready in ${Date.now() - started}ms while primary and Cambridge remain blocked`);
  await page.waitForFunction(async () => Boolean((await chrome.storage.local.get('spelt_lookup_cache_v1')).spelt_lookup_cache_v1?.learning));
  await page.reload();
  await page.evaluate(() => { window.offline = true; });
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#word-input').fill('learning');
  const cachedStarted = Date.now();
  await page.locator('#verify-word-btn').click();
  await page.locator('#feedback-def-display').waitFor({ timeout: 1000 });
  assert.match(await page.locator('#feedback-def-display').innerText(), /a fast Oxford meaning/);
  assert.equal(await page.locator('#verify-word-btn').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log(`PASS cached meaning ready in ${Date.now() - cachedStarted}ms after reopening with all providers blocked`);

} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
