// Keyboard navigation and the on-screen control mapping.
//
// Verifies that arrow keys move focus, that the mapping panel documents every
// required handheld input, and that Escape dismisses the panel. Requires the
// app running; see GAMEHUB_UI / CHROME_BIN / PUPPETEER_CORE below.
import { isAbsolute } from 'node:path';

const puppeteerPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(
  puppeteerPath && isAbsolute(puppeteerPath) ? puppeteerPath : 'puppeteer-core'
)).default;

const BASE = process.env.GAMEHUB_UI ?? 'http://127.0.0.1:18480';
const CHROME = process.env.CHROME_BIN ?? '/run/current-system/sw/bin/chromium';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const REQUIRED_BUTTONS = ['A', 'B', 'X', 'Y', 'START', 'SELECT', 'MENU', 'L1 · R1', 'L2 · R2', 'D-Pad'];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  ok   ${name}`);
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ' ' + detail : ''}`); }
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 320 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(800);

  const before = await page.evaluate(() => {
    document.querySelector('[data-focusable]')?.focus();
    return document.activeElement?.textContent?.trim().slice(0, 20);
  });
  await page.keyboard.press('ArrowDown');
  await sleep(250);
  const after = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
  check('ArrowDown moves focus', before !== after, `${before} -> ${after}`);

  await page.keyboard.press('m');
  await sleep(400);
  check('M opens the controls panel', await page.evaluate(() => !!document.querySelector('.control-modal')));

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.mapping-list > div')].map(row => row.textContent.trim()));
  for (const button of REQUIRED_BUTTONS) {
    check(`mapping documents ${button}`, rows.some(row => row.startsWith(button)));
  }

  await page.keyboard.press('Escape');
  await sleep(300);
  check('Escape dismisses the panel', await page.evaluate(() => !document.querySelector('.control-modal')));
} finally {
  await browser.close();
}

console.log(failures.length ? `FAILURES: ${failures.join(', ')}` : 'ALL INPUT MAPPING CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
