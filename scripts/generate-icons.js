import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, ...(process.env.SPELT_CHROMIUM_PATH ? { executablePath: process.env.SPELT_CHROMIUM_PATH } : {}) });
try {
  const source = await readFile(new URL('../icons/mark.svg', import.meta.url), 'utf8');
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${source}`);
    await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: true });
  }
  console.log('Generated extension icons from icons/mark.svg');
} finally {
  await browser.close();
}
