import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/learning-qa');
const profile = await mkdtemp(path.join(os.tmpdir(), 'spelt-learning-qa-'));
const results = [];
const axeResults = [];
const layoutFailures = [];
let context;
await mkdir(output, { recursive: true });
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: true, viewport: { width: 420, height: 600 },
    ...(process.env.SPELT_CHROMIUM_PATH ? { executablePath: process.env.SPELT_CHROMIUM_PATH } : {}),
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = worker.url().replace(/\/background\.js$/, '');
  const base = `${origin}/dist/popup.html`;
  const page = await context.newPage();
  // Chromium extension host-permission fetches bypass Playwright routing.
  // Control only external providers at the page boundary; reviews still run in the real worker.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!url.startsWith('https://')) return originalFetch(input, init);
      if (!navigator.onLine) throw new TypeError('Network unavailable');
      if (url.includes('dictionaryapi.dev/api/v2/entries/en/necessary')) {
        return new Response(JSON.stringify([{ word: 'necessary', phonetics: [], meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'needed for a purpose', example: 'A ticket is necessary for the journey.' }] }] }]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}', { status: 404 });
    };
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const words = () => page.evaluate(async () => (await chrome.storage.local.get('spelt_words')).spelt_words || []);
  const activeWord = () => page.evaluate(async () => (await import('../popup/js/practice/state.js')).peekCard().word);
  const waitForCount = (selector, count) => page.waitForFunction(([selector, count]) => document.querySelector(selector).textContent === String(count), [selector, count]);
  const go = async tab => { await page.locator(`#${tab}-tab-button`).click(); await page.locator(`#${tab}-tab.active`).waitFor(); };
  const check = (name, value) => { assert.ok(value, name); results.push(name); console.log(`PASS ${name}`); };

  await page.goto(base);
  await page.locator('.collection-add').first().waitFor();
  check('fresh install opens Today without adding sample data', (await words()).length === 0);
  check('action popup has a usable 420 by 600 layout', await page.evaluate(() => document.documentElement.classList.contains('extension-popup') && document.documentElement.clientWidth === 420));
  await page.screenshot({ animations: 'disabled', path: path.join(output, 'popup-fresh.png') });
  await page.locator('[data-collection="double-letters"]').click();
  await page.locator('#collection-status').filter({ hasText: '5 words added' }).waitFor();
  check('collection adds five complete words without daily review credit', (await words()).length === 5 && await page.locator('#today-reviewed').innerText() === '0');
  check('an added collection cannot be added twice', await page.locator('[data-collection="double-letters"]').isDisabled());
  await page.locator('#today-start').click();
  await page.locator('#practice-definition').filter({ hasText: 'room' }).waitFor();
  check('hidden answer controls cannot receive keyboard focus', await page.locator('.card-back').evaluate(element => element.inert));
  await page.locator('#spelling-input').fill('accommodate');
  await page.locator('#check-spelling-btn').click();
  await page.locator('#spelling-memory-note').waitFor();
  check('bundled memory cues appear after the answer is revealed', (await page.locator('#spelling-memory-text').innerText()).includes('Two c'));
  await page.locator('.srs-good').click();
  await page.waitForFunction(() => document.getElementById('practice-definition').textContent.includes('purpose'));
  const correct = (await words()).find(word => word.word === 'accommodate');
  check('real service worker preserves a correct answer and its streak', correct.history.length === 1 && correct.history[0].correct === true && correct.totalErrors === 0 && correct.correctStreak === 1);
  await page.locator('#spelling-input').fill('neccessary');
  await page.locator('#check-spelling-btn').click();
  await page.locator('.srs-again').click();
  await page.waitForFunction(() => document.getElementById('practice-definition').textContent.includes('choice'));
  const wrong = (await words()).find(word => word.word === 'necessary');
  check('a misspelling is recorded and Again requeues the word', wrong.history[0].correct === false && wrong.totalErrors === 1 && wrong.misspellings.includes('neccessary'));
  check('review save does not advance the deck twice during storage events', await activeWord() === 'recommend');
  await go('today');
  await waitForCount('#today-reviewed', 2);
  check('Today reflects real completed reviews', await page.locator('#today-reviewed').innerText() === '2');
  await go('settings');
  await page.locator('#setting-daily-goal').selectOption('5');
  await page.locator('#setting-theme').selectOption('dark');
  await page.waitForFunction(async () => (await chrome.storage.local.get('spelt_theme')).spelt_theme === 'dark');
  await page.reload();
  await page.locator('.collection-add').first().waitFor();
  await go('settings');
  check('daily target and theme survive reopening the extension', await page.locator('#setting-daily-goal').inputValue() === '5' && await page.locator('html').getAttribute('data-theme') === 'dark');
  await go('practice');
  await page.locator('#practice-mode-recall').click();
  await page.locator('#front-recall-content:not(.hidden)').waitFor();
  await page.waitForFunction(async () => (await chrome.storage.local.get('spelt_practice_mode')).spelt_practice_mode === 'recall');
  await page.goto(`${base}?standalone=1#practice`);
  await page.locator('#front-recall-content:not(.hidden)').waitFor();
  check('saved recall mode is restored before the deck loads', await page.locator('#practice-mode-recall').getAttribute('aria-pressed') === 'true');
  const recalled = await activeWord();
  await page.locator('#reveal-recall-btn').click();
  await page.locator('.srs-good').click();
  await page.waitForFunction(async name => (await chrome.storage.local.get('spelt_words')).spelt_words.find(word => word.word === name).history.some(review => review.mode === 'meaning'), recalled);
  check('recall schedules independently from spelling', (await words()).find(word => word.word === recalled).history.some(review => review.mode === 'meaning' && review.correct));

  await go('sandbox');
  await page.locator('#word-input').fill('necessary');
  await page.locator('#verify-word-btn').click();
  await page.waitForFunction(() => !document.getElementById('verify-word-btn').disabled);
  check('Discover displays a dictionary lookup result', (await page.locator('#feedback-msg').innerText()).toLowerCase().includes('necessary'));
  await context.setOffline(true);
  await page.locator('#word-input').fill('offline');
  await page.locator('#verify-word-btn').click();
  await page.locator('#feedback-msg').filter({ hasText: 'couldn’t look up' }).waitFor();
  check('failed lookup provides a retry and preserves the saved vault', !(await page.locator('#verify-word-btn').isDisabled()) && (await words()).length === 5);
  await context.setOffline(false);
  await go('vault');
  await page.locator('#vault-search').fill('necessary');
  await page.waitForFunction(() => document.querySelectorAll('#popup-vault-list>li').length === 1);
  check('Vault search finds the collected word', (await page.locator('#popup-vault-list').innerText()).includes('necessary'));
  await page.locator('#popup-vault-list .edit-btn').click();
  await page.locator('#word-form-modal[open]').waitFor();
  check('word editor restores the memory cue', (await page.locator('#form-notes').inputValue()).includes('One c'));
  await page.locator('#form-notes').fill('One collar, two sleeves. My own memory cue.');
  await page.locator('#form-practice-type').selectOption('spelling');
  await page.screenshot({ animations: 'disabled', path: path.join(output, 'word-editor.png') });
  if (process.env.SPELT_AXE_PATH) {
    await page.evaluate(await readFile(process.env.SPELT_AXE_PATH, 'utf8'));
    const audit = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
    axeResults.push({ theme: 'dark', width: 420, tab: 'word-editor', violations: audit });
  }
  await page.locator('#word-entry-form [type="submit"]').click();
  await page.waitForFunction(() => !document.getElementById('word-form-modal').open);
  const edited = (await words()).find(word => word.word === 'necessary');
  check('memory cue and native practice selector save without losing review history', edited.notes.includes('My own memory cue') && edited.practiceType === 'spelling' && edited.history.length === 1);
  await page.locator('#vault-search').fill('');
  await page.locator('#vault-tab-button').focus();
  await page.keyboard.press('ArrowRight');
  check('arrow-key navigation keeps focus on the active tab', await page.locator('#stats-tab-button').evaluate(element => document.activeElement === element && element.getAttribute('aria-selected') === 'true'));

  for (const theme of ['light', 'dark']) {
    await go('settings');
    await page.locator('#setting-theme').selectOption(theme);
    for (const [width, height] of [[320, 700], [420, 600], [580, 850], [1200, 1000]]) {
      await page.setViewportSize({ width, height });
      for (const tab of ['today', 'sandbox', 'practice', 'vault', 'stats', 'settings']) {
        await go(tab);
        if (tab === 'today') await page.locator('.collection-add').first().waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.querySelector('.popup-main').scrollWidth > document.querySelector('.popup-main').clientWidth + 1);
        if (overflow) {
          const elements = await page.evaluate(() => [...document.querySelectorAll('.popup-main *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag: element.tagName, id: element.id, className: String(element.className), right: element.getBoundingClientRect().right })).slice(0, 15));
          layoutFailures.push({ theme, width, tab, elements });
          console.log('OVERFLOW', theme, width, tab, JSON.stringify(elements));
        } else check(`${theme} ${width}px ${tab}: no horizontal overflow`, true);
        if (width === 1200 || width === 420) await page.screenshot({ animations: 'disabled', path: path.join(output, `${theme}-${width}-${tab}.png`) });
        if (process.env.SPELT_AXE_PATH && (width === 420 || width === 1200)) {
          await page.evaluate(await readFile(process.env.SPELT_AXE_PATH, 'utf8'));
          const audit = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
          axeResults.push({ theme, width, tab, violations: audit });
        }
      }
    }
  }
  await go('stats');
  for (const view of ['vocabulary', 'activity', 'performance', 'overview']) {
    await page.locator(`#stats-${view}-button`).click();
    await page.locator(`#stats-subtab-${view}.active`).waitFor();
  }
  check('all progress views render', true);
  await go('settings');
  for (let index = 0; index < 5; index++) await page.locator('#font-increase-btn').click();
  await page.waitForFunction(() => document.getElementById('font-scale-display').textContent === '150%');
  for (const width of [320, 420]) {
    await page.setViewportSize({ width, height: 700 });
    for (const tab of ['today', 'sandbox', 'practice', 'vault', 'stats', 'settings']) {
      await go(tab);
      const fits = await page.evaluate(() => document.querySelector('.popup-main').scrollWidth <= document.querySelector('.popup-main').clientWidth + 1);
      check(`150% text at ${width}px: ${tab} fits`, fits);
    }
  }
  check('no uncaught page errors', errors.length === 0);
  check('all layouts fit their viewport', layoutFailures.length === 0);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ results, errors, layoutFailures, accessibility: axeResults }, null, 2));
  console.log(`${results.length} checks passed. Screenshots and report: ${output}`);
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
