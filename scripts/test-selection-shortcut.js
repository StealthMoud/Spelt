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
  await page.goto(worker.url().replace(/\/background\.js$/, '/dist/popup.html#popout'));
  await page.locator('#sandbox-tab-button').click();
  await page.evaluate(() => {
    const text = document.getElementById('sandbox-empty-hint').firstChild;
    const start = text.textContent.indexOf('spelling');
    const range = document.createRange(); range.setStart(text, start); range.setEnd(text, start + 8);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  const target = await page.evaluate(() => chrome.tabs.getCurrent());
  const driver = await context.newPage();
  await driver.goto(page.url());
  const captured = await driver.evaluate(async tab => {
    const { captureSelectedText } = await import('../background/selection.js');
    return captureSelectedText(tab);
  }, target);
  assert.equal(captured, 'spelling');
  console.log('PASS shortcut reads selected text from the real Spelt popout');
  await page.locator('#word-input').fill('selected input');
  await page.locator('#word-input').evaluate(input => { input.focus(); input.setSelectionRange(0, 8); });
  const inputCaptured = await driver.evaluate(async tab => {
    const { captureSelectedText } = await import('../background/selection.js');
    return captureSelectedText(tab);
  }, target);
  assert.equal(inputCaptured, 'selected');
  console.log('PASS shortcut reads a selection inside a Spelt input');
  const saved = await driver.evaluate(async tab => {
    const original = window.fetch;
    window.fetch = async () => new Response('{}', { status: 404 });
    try {
      const { handleSelectionShortcut } = await import('../background/selection.js');
      await handleSelectionShortcut('add-selection-to-spelt', tab);
      const { getWords } = await import('../shared/storage.js');
      return (await getWords()).map(word => word.word);
    } finally { window.fetch = original; }
  }, target);
  assert.ok(saved.includes('selected'));
  console.log('PASS command handler adds the captured word to the real isolated vault');
  await context.route('https://api.dictionaryapi.dev/spelt-shortcut-test', route => route.fulfill({ contentType: 'text/html', body: '<p id="sample">ordinary</p>' }));
  const webPage = await context.newPage();
  await webPage.goto('https://api.dictionaryapi.dev/spelt-shortcut-test');
  await webPage.evaluate(() => {
    const range = document.createRange(); range.selectNodeContents(document.getElementById('sample'));
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  const webCaptured = await driver.evaluate(async () => {
    const { captureSelectedText } = await import('../background/selection.js');
    const [tab] = await chrome.tabs.query({ url: 'https://api.dictionaryapi.dev/spelt-shortcut-test' });
    return captureSelectedText(tab);
  });
  assert.equal(webCaptured, 'ordinary');
  console.log('PASS regular web-page selections still use Chrome scripting');
  const messages = await driver.evaluate(async () => {
    const { selectionAccessMessage } = await import('../background/selection.js');
    const error = new Error('Cannot access contents of the page');
    return [
      selectionAccessMessage({ url: 'chrome://extensions' }, error),
      selectionAccessMessage({ url: 'file:///sample.pdf' }, error),
      selectionAccessMessage({ url: 'https://example.org' }, error)
    ];
  });
  assert.match(messages[0], /Chrome blocks/);
  assert.match(messages[1], /Allow access to file URLs/);
  assert.doesNotMatch(messages[2], /Allow access to file URLs/);
  console.log('PASS restricted pages and local files receive distinct, accurate guidance');
  assert.deepEqual(errors, []);

} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
