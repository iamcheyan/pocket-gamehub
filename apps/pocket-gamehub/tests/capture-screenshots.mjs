// Capture the Pocket GameHub screenshot matrix from a running production build.
//
//   GAMEHUB_UI=http://127.0.0.1:18480 \
//   PUPPETEER_CORE=$HOME/.bun/install/global/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js \
//   CHROME_BIN=/usr/bin/google-chrome node tests/capture-screenshots.mjs
//
// The UI has no URL router, so every state is reached by clicking the real DOM
// (nav buttons, platform chip, game card, search input) exactly like a user.
// Backend settings are reset before each capture so preference persistence can
// never make two views look identical. Fails on: duplicate hash, wrong PNG
// size, horizontal overflow, missing rendered text, or any console/HTTP error.
import { isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const puppeteerPath = process.env.PUPPETEER_CORE;
const puppeteer = (await import(
  puppeteerPath && isAbsolute(puppeteerPath) ? puppeteerPath : 'puppeteer-core'
)).default;

const BASE = (process.env.GAMEHUB_UI ?? 'http://127.0.0.1:18480').replace(/\/$/, '');
const API = (process.env.GAMEHUB_API ?? 'http://127.0.0.1:18470').replace(/\/$/, '');
const CHROME = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
const OUT = path.resolve(process.env.GAMEHUB_SHOTS ?? 'apps/pocket-gamehub/docs/screenshots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const SIZES = [
  [320, 240],
  [480, 320],
  [640, 480],
  [720, 720],
  [1280, 720],
  [1920, 1080],
];
const VIEWS = ['home', 'library', 'platform-list', 'detail', 'search', 'collections', 'settings', 'dark', 'light'];

const setSettings = async (settings) => {
  const response = await fetch(`${API}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error(`PUT /api/settings -> ${response.status}`);
};

const clickNav = async (page, label) => {
  const ok = await page.evaluate((wanted) => {
    const button = [...document.querySelectorAll('nav button')].find((node) =>
      (node.textContent ?? '').toLowerCase().includes(wanted),
    );
    if (!button) return false;
    button.click();
    return true;
  }, label.toLowerCase());
  if (!ok) throw new Error(`nav button "${label}" not found`);
  await sleep(450);
};

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });

const seen = new Map();
const manifest = [];

const prepare = async (view) => {
  if (view === 'dark') await setSettings({ theme: 'dark', language: 'en' });
  else if (view === 'light') await setSettings({ theme: 'light', language: 'zh' });
  else await setSettings({ theme: 'light', language: 'en' });
};

const drive = async (view) => {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);
  if (view === 'home' || view === 'dark' || view === 'light') return;
  if (view === 'library' || view === 'platform-list' || view === 'detail') {
    await clickNav(page, 'library');
    if (view === 'platform-list') {
      const clicked = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.platform-chip')].find((node) =>
          (node.textContent ?? '').startsWith('GBA'),
        );
        if (!chip) return false;
        chip.click();
        return true;
      });
      if (!clicked) throw new Error('GBA platform chip not found');
      await sleep(500);
    }
    if (view === 'detail') {
      const opened = await page.evaluate(() => {
        const card = document.querySelector('.game-card');
        if (!card) return false;
        card.click();
        return true;
      });
      if (!opened) throw new Error('no game card to open');
      await sleep(650);
    }
  } else if (view === 'search') {
    await clickNav(page, 'search');
    const input = await page.$('.searchbar input');
    if (!input) throw new Error('search input not found');
    await input.type('Mario');
    await sleep(700);
  } else {
    await clickNav(page, view === 'collections' ? 'collections' : 'settings');
  }
};

const capture = async (name, width, height, dsf = 1) => {
  await page.setViewport({ width, height, deviceScaleFactor: dsf });
  await page.waitForTimeout?.(0);
  await sleep(250);
  const audit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    text: document.body.innerText.trim().length,
    title: document.title,
  }));
  if (audit.overflow > 1) throw new Error(`${name}: horizontal overflow ${audit.overflow}px`);
  if (audit.text < 40) throw new Error(`${name}: page rendered almost no text (${audit.text})`);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') throw new Error(`${name}: not a PNG`);
  const w = bytes.readUInt32BE(16);
  const h = bytes.readUInt32BE(20);
  if (w !== Math.round(width * dsf) || h !== Math.round(height * dsf)) {
    throw new Error(`${name}: PNG ${w}x${h}, expected ${Math.round(width * dsf)}x${Math.round(height * dsf)}`);
  }
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (seen.has(sha)) throw new Error(`${name}: duplicate of ${seen.get(sha)}`);
  seen.set(sha, name);
  manifest.push({ name: `${name}.png`, width: w, height: h, css: `${width}x${height}`, dsf, sha256: sha });
  console.log(`${name}: ${w}x${h} sha256=${sha.slice(0, 16)}`);
};

try {
  for (const [width, height] of SIZES) {
    for (const view of VIEWS) {
      await prepare(view);
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await drive(view);
      await capture(`${view}-${width}x${height}`, width, height);
    }
  }
  // DPI: same 480x320 logical viewport at 1.5x / 2x / 3x device scale.
  await prepare('home');
  await page.setViewport({ width: 480, height: 320, deviceScaleFactor: 1.5 });
  await drive('home');
  await capture('dpi-1_5x-720x480', 480, 320, 1.5);
  await page.setViewport({ width: 480, height: 320, deviceScaleFactor: 2 });
  await drive('home');
  await capture('dpi-2x-960x640', 480, 320, 2);
  await page.setViewport({ width: 480, height: 320, deviceScaleFactor: 3 });
  await drive('home');
  await capture('dpi-3x-1440x960', 480, 320, 3);
} finally {
  await page.close();
  await browser.close();
}

if (errors.length) {
  throw new Error(`console/HTTP errors during capture:\n${[...new Set(errors)].join('\n')}`);
}
await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify({ captured_at: new Date().toISOString(), ui: BASE, api: API, chrome: CHROME, screenshots: manifest }, null, 2)}\n`);
console.log(`captured ${manifest.length} screenshots, ${seen.size} unique hashes, no overflow, no console errors`);
