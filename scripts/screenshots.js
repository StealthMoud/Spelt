import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionPath = path.resolve(__dirname);
const docsPath = path.resolve(__dirname, 'docs');

if (!fs.existsSync(docsPath)) {
  fs.mkdirSync(docsPath, { recursive: true });
}

(async () => {
  const userDataDir = path.join(__dirname, '.chrome-profile');
  
  console.log('Launching browser with extension...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 360, height: 530 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  // Find extension ID from background service worker
  let [backgroundPage] = context.serviceWorkers();
  if (!backgroundPage) {
    backgroundPage = await context.waitForEvent('serviceworker');
  }
  const extensionId = backgroundPage.url().split('/')[2];
  console.log('Extension ID:', extensionId);

  const page = await context.newPage();

  // MOCK all network services for fast, deterministic, clean screenshots
  console.log('Setting up mock API routes...');

  // Mock Gemini API responses (Mnemonic hint generation)
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    console.log(`[Mock API] Intercepted Gemini: ${route.request().url()}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: 'Visual Mnemonic: Cereal is eaten from a bowl (which has a C shape). Connect the C in Cereal to the shape of the bowl.'
            }]
          }
        }]
      })
    });
  });

  // Mock Dictionary API - "cereal"
  await page.route('**/api.dictionaryapi.dev/api/v2/entries/en/cereal', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        word: 'cereal',
        phonetics: [{ text: '/ˈsɪə.ri.əl/', audio: '' }],
        meanings: [{
          partOfSpeech: 'noun',
          definitions: [{
            definition: 'a plant that is grown to produce grain',
            example: 'Cereal crops are grown in large quantities in this region.'
          }]
        }]
      }])
    });
  });

  // Mock Dictionary API - "accommodate"
  await page.route('**/api.dictionaryapi.dev/api/v2/entries/en/accommodate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        word: 'accommodate',
        phonetics: [{ text: '/əˈkɒm.ə.deɪt/', audio: '' }],
        meanings: [{
          partOfSpeech: 'verb',
          definitions: [{
            definition: 'provide lodging or sufficient space for',
            example: 'The cabins accommodate up to six people.'
          }]
        }]
      }])
    });
  });

  // Mock Dictionary API - "acomodate" (fails to trigger suggestions lookup)
  await page.route('**/api.dictionaryapi.dev/api/v2/entries/en/acomodate', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{}'
    });
  });

  // Mock Datamuse Spelling Suggestions API for "acomodate"
  await page.route('**/api.datamuse.com/sug?s=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { word: 'accommodate', score: 1000 }
      ])
    });
  });

  // Mock Google Translate API
  await page.route('**/translate.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([['cereal', 'cereal', null, null, 1]])
    });
  });

  // Prevent real Cambridge Dictionary scrapers from blocking screenshot rendering
  await page.route('**/dictionary.cambridge.org/**', async (route) => {
    await route.fulfill({ status: 404 });
  });

  // Set up mock data in storage
  console.log('Injecting mock storage data...');
  await page.goto(`chrome-extension://${extensionId}/dist/popup.html`);
  
  await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        spelt_gemini_key: 'test-key',
        spelt_gemini_model: 'models/gemini-2.5-flash',
        spelt_gemini_models_list: ['models/gemini-2.5-flash'],
        spelt_target_lang: 'es',
        spelt_words: [
          {
            id: 'w1',
            word: 'cereal',
            definition: 'a plant that is grown to produce grain',
            transcription: '/ˈsɪə.ri.əl/',
            partOfSpeech: 'noun',
            translation: 'cereal',
            level: 'C1',
            example: 'Cereal crops are grown in large quantities in this region.',
            rep: 3,
            interval: 5,
            ef: 2.6,
            nextDate: Date.now() - 10000,
            practiceType: 'both',
            totalErrors: 0,
            correctStreak: 2,
            history: []
          },
          {
            id: 'w2',
            word: 'accommodate',
            definition: 'provide lodging or sufficient space for',
            transcription: '/əˈkɒm.ə.deɪt/',
            partOfSpeech: 'verb',
            translation: 'alojar',
            level: 'B2',
            example: 'The cabins accommodate up to six people.',
            rep: 1,
            interval: 1,
            ef: 2.3,
            nextDate: Date.now() + 100000000,
            practiceType: 'both',
            totalErrors: 3,
            correctStreak: 0,
            misspellings: ['acomodate', 'accomodate'],
            history: []
          },
          {
            id: 'w3',
            word: 'necessary',
            definition: 'needed to be done, achieved, or present; essential',
            transcription: '/ˈnes.ə.ser.i/',
            partOfSpeech: 'adjective',
            translation: 'necesario',
            level: 'A2',
            example: 'It is not necessary to wear a tie.',
            rep: 5,
            interval: 12,
            ef: 2.8,
            nextDate: Date.now() + 200000000,
            practiceType: 'both',
            totalErrors: 1,
            correctStreak: 3,
            history: []
          }
        ],
        spelt_streak: { current: 5, max: 12, lastDate: '2026-07-02' },
        spelt_activity: {
          '2026-06-26': 5,
          '2026-06-27': 8,
          '2026-06-28': 12,
          '2026-06-29': 6,
          '2026-06-30': 15,
          '2026-07-01': 4,
          '2026-07-02': 10
        },
        spelt_sandbox_activity: {
          '2026-07-02': { checks: 15, correct: 10, misspelled: 5, notFound: 0 }
        },
        spelt_sessions: [
          { startTime: Date.now() - 3600000, endTime: Date.now() - 3000000 }
        ],
        spelt_stats_ai_insights: {
          overview: '<ul><li><strong>Spelling Accuracy:</strong> You have a strong spelling accuracy of 67% across active reviews.</li><li><strong>Consistent Practice:</strong> You have maintained a 5-day practice streak. Consistency is key!</li></ul>',
          vocabulary: 'Your CEFR vocabulary distribution is concentrated in the B2-C1 range. Focus on strengthening B2 words.',
          activity: 'Consistent daily practice shows active engagement. Try to schedule short reviews twice daily.',
          performance: 'Average response time is 1800ms. Keep practicing to speed up recall.'
        },
        spelt_stats_ai_insights_hash: '3-0-2-0-1-10-67-5-12-accommodate (3 errors)-A1/A2 (Beginner): 1, B1/B2 (Intermediate): 1, C1/C2 (Advanced): 1-15-1800-1-10'
      }, () => resolve());
    });
  });

  // Reload to pick up the updated storage data
  await page.reload();
  await page.waitForTimeout(500);

  // Helper to override HTML width/height constraints and resize viewport to fit content without scrolling
  const adjustViewport = async () => {
    await page.waitForTimeout(300); // Allow transitions to finish
    const bodyHeight = await page.evaluate(() => {
      // Temporarily expand body height styles for taking a full-size clean screenshot
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
      document.body.style.maxHeight = 'none';
      document.body.style.overflow = 'visible';
      
      const popup = document.querySelector('.spelt-popup');
      if (popup) {
        popup.style.height = 'auto';
        popup.style.maxHeight = 'none';
      }
      return document.body.scrollHeight;
    });
    console.log(`Resizing viewport to 360x${Math.max(530, bodyHeight)}`);
    await page.setViewportSize({ width: 360, height: Math.max(530, bodyHeight) });
    await page.waitForTimeout(100);
  };

  // 1. Default Sandbox Screen
  console.log('Capturing sandbox main screen...');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-popup.png') });

  // 2. Sandbox Correct card
  console.log('Verifying spelling "cereal" in sandbox...');
  await page.fill('#word-input', 'cereal');
  await page.press('#word-input', 'Enter');
  
  // Wait until the lookup completes and feedback-def-display updates
  await page.waitForFunction(() => {
    const el = document.getElementById('feedback-def-display');
    return el && el.textContent.includes('Definition:') && !el.textContent.includes('Verifying spelling');
  }, { timeout: 15000 });

  console.log('Capturing sandbox correct card...');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-sandbox-correct.png') });

  // 3. Sandbox Misspelled card
  console.log('Clearing sandbox...');
  await page.click('.feedback-close-btn');
  await page.waitForTimeout(300);

  console.log('Verifying spelling "acomodate" in sandbox...');
  await page.fill('#word-input', 'acomodate');
  await page.press('#word-input', 'Enter');

  // Wait until misspelled card renders suggestions
  await page.waitForFunction(() => {
    const el = document.getElementById('feedback-msg');
    return el && el.textContent.includes('Misspelling Detected') && !el.textContent.includes('Retrieving suggestions');
  }, { timeout: 15000 });

  console.log('Capturing sandbox misspelled card...');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-sandbox-incorrect.png') });

  // 4. Practice Deck Front Face (Prompt)
  console.log('Capturing practice front card...');
  await page.click('[data-tab="practice-tab"]');
  await page.waitForSelector('#practice-definition');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-practice-prompt.png') });

  // 5. Practice Deck Back Face (Correct check + AI Hint overlay)
  console.log('Flipping practice card by typing correct spelling...');
  await page.fill('#spelling-input', 'cereal');
  await page.press('#spelling-input', 'Enter');

  // Wait for the card flipped animation to complete
  await page.waitForFunction(() => {
    return document.getElementById('popup-deck-card')?.classList.contains('flipped');
  }, { timeout: 5000 });

  console.log('Opening back face AI Mnemonic Hint...');
  await page.click('#back-ai-hint-btn');
  
  // Wait for Gemini mock response to load and show up in the hint bubble
  await page.waitForFunction(() => {
    const el = document.getElementById('back-ai-hint-bubble');
    const txt = document.getElementById('back-ai-hint-text');
    return el && window.getComputedStyle(el).display === 'block' && txt && txt.textContent !== '' && !txt.textContent.includes('Asking AI Coach');
  }, { timeout: 10000 });

  console.log('Capturing practice back card with AI Mnemonic hint...');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-practice-result.png') });
  await page.click('#back-ai-hint-close'); // Hide hint bubble

  // 6. Word Vault Screen
  console.log('Capturing word vault list...');
  await page.click('[data-tab="vault-tab"]');
  await page.waitForSelector('.vault-list-item');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-vault.png') });

  // 7. Statistics Dashboard Screen
  console.log('Capturing statistics dashboard...');
  await page.click('[data-tab="stats-tab"]');
  await page.waitForSelector('#stats-retention');
  await adjustViewport();
  await page.screenshot({ path: path.join(docsPath, 'screenshot-stats.png') });

  console.log('Cleaning up...');
  await context.close();
  console.log('Screenshots generated successfully!');
})();
