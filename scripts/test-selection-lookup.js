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
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('recordLookup', word => requests.push(word));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return original(input, init);
      if (url.includes('dictionaryapi.dev/api/v2/entries/en/')) {
        await window.recordLookup(decodeURIComponent(url.split('/').at(-1)));
        return new Response(JSON.stringify([{ word: 'spelling', phonetics: [], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'the letters used to write a word' }] }] }]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    };
  });
  await page.goto(worker.url().replace(/\/background\.js$/, '/dist/popup.html'));
  await page.locator('#sandbox-tab-button').click();
  await page.locator('#sandbox-tab.active').waitFor();
  async function selectWord() {
    await page.evaluate(() => {
      const text = document.getElementById('sandbox-empty-hint').firstChild;
      const start = text.textContent.indexOf('spelling');
      const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + 8);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    });
    await page.locator('#floating-lookup-btn.visible').waitFor();
  }
  await selectWord();
  const button = page.locator('#floating-lookup-btn');
  await button.hover();
  await page.waitForTimeout(250);
  const beforePress = await button.boundingBox();
  // Press near the top edge: moving the target would cancel the release click.
  await page.mouse.move(beforePress.x + beforePress.width / 2, beforePress.y + 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const duringPress = await button.boundingBox();
  assert.deepEqual(duringPress, beforePress, 'Lookup must stay in place while pressed');
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('feedback-msg').textContent.includes('the letters used to write a word'));
  assert.deepEqual(requests, ['spelling']);
  console.log('PASS selected text survives pointer click and reaches the dictionary result');
  await page.reload(); await page.locator('#sandbox-tab-button').click();
  await selectWord();
  await page.locator('#floating-lookup-btn').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('feedback-msg').textContent.includes('the letters used to write a word'));
  assert.deepEqual(requests, ['spelling'], 'Repeat lookup should reuse the cached definition');
  console.log('PASS keyboard activation looks up the selected word');
  await page.reload(); await page.locator('#sandbox-tab-button').click();
  await selectWord();
  await page.locator('#word-input').click();
  await page.locator('#floating-lookup-btn.visible').waitFor({ state: 'hidden' });
  assert.deepEqual(requests, ['spelling'], 'Repeat lookup should reuse the cached definition');
  assert.deepEqual(errors, []);
  console.log('PASS clearing selection dismisses the button without a stale lookup');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
