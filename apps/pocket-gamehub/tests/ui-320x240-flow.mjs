// Browser-level verification of the smallest supported viewport.
//
// Drives the real running app with Chromium via puppeteer-core and asserts the
// 320x240 flow is genuinely usable: browse -> detail -> favourite -> launch.
// Requires a running backend/frontend pair; see the header below.
//
// Env: GAMEHUB_UI http://127.0.0.1:18480  GAMEHUB_API http://127.0.0.1:18470
//      CHROME_BIN /path/to/chromium  PUPPETEER_CORE /path/to/puppeteer-core.js
import { isAbsolute } from 'node:path';

const puppeteerPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(
  puppeteerPath && isAbsolute(puppeteerPath) ? puppeteerPath : 'puppeteer-core'
)).default;

const BASE = process.env.GAMEHUB_UI ?? 'http://127.0.0.1:18480';
const API = process.env.GAMEHUB_API ?? 'http://127.0.0.1:18470';
const CHROME = process.env.CHROME_BIN ?? '/run/current-system/sw/bin/chromium';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 320x240 must support the whole flow: browse -> detail -> favourite -> launch.
await fetch(`${API}/api/settings`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ theme: 'light', language: 'en' }),
});

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-dev-shm-usage'],
});
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  ok   ${name}`);
  else { failures.push(name); console.log(`  FAIL ${name} ${detail}`); }
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 240, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(700);

  // 1. browse: navigate to the library and confirm cards are reachable.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(x => x.textContent?.toLowerCase().includes('library'));
    b?.click();
  });
  await sleep(600);
  const cardCount = await page.evaluate(() => document.querySelectorAll('.game-card').length);
  check('library renders game cards at 320x240', cardCount > 0, `count=${cardCount}`);

  // The nav bar is fixed; the first card must still sit inside the viewport.
  const firstCardBox = await page.evaluate(() => {
    const card = document.querySelector('.game-card');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  check('first card visible without scrolling', !!firstCardBox && firstCardBox.top >= 0 && firstCardBox.top < 240, JSON.stringify(firstCardBox));

  // 2. detail
  const gameId = await page.evaluate(() => {
    const card = document.querySelector('.game-card');
    card?.click();
    return card?.dataset.gameId;
  });
  await sleep(800);
  const detailTitle = await page.evaluate(() => document.querySelector('.detail-copy h1')?.textContent ?? '');
  check('detail view opens at 320x240', detailTitle.length > 0, `title=${detailTitle}`);
  const detailBox = await page.evaluate(() => {
    const h1 = document.querySelector('.detail-copy h1');
    if (!h1) return null;
    const r = h1.getBoundingClientRect();
    return { top: r.top, visible: r.top < 240 && r.bottom > 0 };
  });
  check('detail heading within viewport', !!detailBox?.visible, JSON.stringify(detailBox));

  // 3. favourite via the real button, verified through the API
  const before = (await (await fetch(`${API}/api/favorites`)).json())
    .some(g => String(g.id) === String(gameId));
  const favButton = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.detail-actions button')]
      .find(b => /favorite/i.test(b.textContent ?? ''));
    btn?.click();
    return btn?.textContent ?? '';
  });
  // The toggle is optimistic in the UI but the API call is async; poll briefly
  // instead of assuming a fixed render/callback latency.
  let after = before;
  for (let attempt = 0; attempt < 20 && after === before; attempt += 1) {
    await sleep(150);
    after = (await (await fetch(`${API}/api/favorites`)).json())
      .some(g => String(g.id) === String(gameId));
  }
  check('favourite toggles from detail action', before !== after,
    `before=${before} after=${after} button="${favButton}" game=${gameId}`);

  // 4. launch control: present, but explicitly disabled because RetroArch is absent.
  const launchState = await page.evaluate(() => {
    const btn = document.querySelector('.detail-actions .primary-button');
    return btn ? { found: true, disabled: btn.disabled, text: btn.textContent?.trim() ?? '' } : { found: false };
  });
  check('launch control present at 320x240', launchState.found, JSON.stringify(launchState));
  check('launch disabled while emulator is unavailable', launchState.disabled === true, JSON.stringify(launchState));
  check('launch label states unavailability', /unavailable/i.test(launchState.text), `text="${launchState.text}"`);
} finally {
  await browser.close();
}

console.log(failures.length ? `FAILURES: ${failures.join(', ')}` : 'ALL 320x240 FLOW CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
