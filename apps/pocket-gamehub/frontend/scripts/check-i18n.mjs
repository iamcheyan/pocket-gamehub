import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const localeSource = await readFile(fileURLToPath(new URL('../src/i18n.ts', import.meta.url)), 'utf8');
const locales = [...localeSource.matchAll(/^  (en|zh|ja): \{([^\n]*)\},?$/gm)];
if (locales.length !== 3) throw new Error(`Expected en, zh, and ja locales; found ${locales.map(match => match[1]).join(', ')}`);
const keysByLocale = {};
for (const [, locale, body] of locales) {
  const matches = [...body.matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9]*):\s*'/g)];
  const keys = matches.map(match => match[1]);
  if (keys.length === 0) throw new Error(`No message keys found in ${locale}`);
  if (new Set(keys).size !== keys.length) throw new Error(`Duplicate localization keys found in ${locale}`);
  keysByLocale[locale] = new Set(keys);
}
const reference = keysByLocale.en;
for (const locale of ['zh', 'ja']) {
  const missing = [...reference].filter(key => !keysByLocale[locale].has(key));
  const extra = [...keysByLocale[locale]].filter(key => !reference.has(key));
  if (missing.length || extra.length) throw new Error(`${locale} key mismatch; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
}
const appSource = await readFile(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8');
const references = new Set([...appSource.matchAll(/\bt\('([A-Za-z][A-Za-z0-9]*)'\)/g)].map(match => match[1]));
const unknown = [...references].filter(key => !reference.has(key));
if (unknown.length) throw new Error(`App uses undefined localization keys: ${unknown.join(', ')}`);
console.log(`Localization keys consistent: ${reference.size} keys in en, zh, ja; ${references.size} referenced by App.`);
