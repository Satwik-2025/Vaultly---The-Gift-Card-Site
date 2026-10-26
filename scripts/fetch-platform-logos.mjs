#!/usr/bin/env node
/**
 * Downloads each seller's own logo into `public/logos/` so the UI can show real
 * brand marks instead of two-letter monograms.
 *
 * Stored locally rather than hotlinked: the sellers' CDNs rotate filenames, and
 * an offline/blocked image would leave the comparison panels unlabelled.
 *
 *   node scripts/fetch-platform-logos.mjs
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'logos');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Candidates are tried in order; the first that returns a usable image wins.
 * Square "app icon" marks are preferred over wide wordmarks — these render in
 * small round tiles, where a wordmark shrinks to an illegible smudge.
 */
const SOURCES = {
  // Their tight header wordmark, NOT the 512px app icon: that icon is the same
  // wordmark plus a tagline floated in whitespace, which renders as an
  // unreadable smudge once scaled into a 44px tile.
  gyftr: [
    'https://www.gyftr.com/static/images/logo.png',
    'https://www.gyftr.com/static/icons/icon-512x512.png',
  ],
  // Icon-only "W" roundel.
  woohoo: [
    'https://b2cstatic.woohoo.in/media/favicon/websites/2/Woohoo_Favicon_2.png',
    'https://www.google.com/s2/favicons?domain=woohoo.in&sz=128',
  ],
  // The full wordmark: the only icon-only smile Amazon exposes is a 48px
  // favicon, which is soft on a 2x display. The tile is aspect-aware, so a wide
  // mark is rendered wide and stays crisp.
  amazon: [
    'https://m.media-amazon.com/images/G/31/social_share/amazon_logo._CB633266945_.png',
    'https://www.google.com/s2/favicons?domain=amazon.in&sz=128',
  ],
  // Not a gift card seller — this one labels the cashback card.
  cashkaro: [
    'https://cashkaro.com/apple-touch-icon.png',
    'https://asset22.ckassets.com/wp/wp-content/themes/CashKaro_WP_V1/img/cashkaro_logo.png',
    'https://www.google.com/s2/favicons?domain=cashkaro.com&sz=128',
  ],
};

/** Anything larger is a wordmark with an embedded bitmap — not worth shipping. */
const MAX_BYTES = 300_000;

const EXT = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  const ext = EXT[type];
  if (!ext) throw new Error(`unusable content-type: ${type || 'none'}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('empty body');
  if (buf.length > MAX_BYTES) throw new Error(`${Math.round(buf.length / 1024)}KB exceeds cap`);

  return { buf, ext };
}

mkdirSync(OUT_DIR, { recursive: true });

const results = [];
for (const [id, urls] of Object.entries(SOURCES)) {
  let saved = null;
  for (const url of urls) {
    try {
      const { buf, ext } = await download(url);
      const file = join(OUT_DIR, `${id}.${ext}`);
      writeFileSync(file, buf);
      saved = { id, file: `logos/${id}.${ext}`, bytes: buf.length, url };
      break;
    } catch (e) {
      results.push({ id, skipped: url, why: e.message });
    }
  }
  if (saved) results.push(saved);
  else console.error(`[logos] ${id}: no usable logo — the UI falls back to its monogram.`);
}

for (const r of results) {
  if (r.file) console.log(`  ${r.id.padEnd(8)} -> public/${r.file}  (${Math.round(r.bytes / 1024)}KB)`);
  else console.log(`  ${r.id.padEnd(8)}    skipped ${r.why}`);
}

// Report what the app will actually find.
console.log('\nOn disk:');
for (const id of Object.keys(SOURCES)) {
  const found = ['png', 'svg', 'webp', 'jpg', 'ico']
    .map((e) => join(OUT_DIR, `${id}.${e}`))
    .find((f) => existsSync(f));
  console.log(`  ${id.padEnd(8)} ${found ? `${found.split(/[\\/]/).pop()} (${statSync(found).size}b)` : 'MISSING'}`);
}
