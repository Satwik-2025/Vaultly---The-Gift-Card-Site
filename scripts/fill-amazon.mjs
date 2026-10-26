/**
 * Backfill Amazon listings for brands the bulk sweep missed.
 *
 * `listBrandUrls` searches four generic phrases for breadth, which only ever
 * surfaces a slice of Amazon's gift card store — The Body Shop and Zee5 were
 * both listed there all along but never appeared in that sweep. This walks the
 * catalog instead and searches Amazon for each brand by name.
 *
 * Opening a brand page already does this live, so this is purely to make the
 * search results right *before* anyone clicks. Safe to interrupt: the catalog
 * is written after every brand.
 *
 * Usage:
 *   node scripts/fill-amazon.mjs                 # brands with no Amazon offer
 *   node scripts/fill-amazon.mjs --all           # re-check every brand
 *   node scripts/fill-amazon.mjs --limit 50
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshSeller } from '../server/refresh.mjs';
import * as amazon from './sources/amazon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'public', 'catalog.json');

const argv = process.argv.slice(2);
const flagValue = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? Number(argv[i + 1]) : fallback;
};

const all = argv.includes('--all');
const limit = flagValue('limit', Infinity);

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const targets = catalog.brands
  .filter((b) => all || !b.offers.some((o) => o.platformId === 'amazon'))
  .slice(0, limit);

console.log(`${targets.length} brand(s) to check on Amazon.\n`);

let added = 0;
let removed = 0;
let i = 0;

for (const brand of targets) {
  i += 1;
  const existing = brand.offers.find((o) => o.platformId === 'amazon');
  let result;
  try {
    result = await refreshSeller('amazon', brand, existing, new Date().toISOString());
  } catch (err) {
    console.log(`[${i}/${targets.length}] ${brand.name} — error: ${err.message}`);
    continue;
  }

  if (result.status === 'added' && result.offer) {
    brand.offers = [...brand.offers.filter((o) => o.platformId !== 'amazon'), result.offer].sort(
      (a, b) => b.headlineDiscountPct - a.headlineDiscountPct,
    );
    added += 1;
    console.log(`[${i}/${targets.length}] + ${brand.name} — Amazon ${result.offer.headlineDiscountPct}% (${result.offer.denominations.length} denoms)`);
  } else if (result.status === 'updated' && result.offer) {
    brand.offers = [...brand.offers.filter((o) => o.platformId !== 'amazon'), result.offer].sort(
      (a, b) => b.headlineDiscountPct - a.headlineDiscountPct,
    );
    console.log(`[${i}/${targets.length}] ~ ${brand.name} — Amazon ${result.offer.headlineDiscountPct}%`);
  } else if (result.status === 'gone') {
    brand.offers = brand.offers.filter((o) => o.platformId !== 'amazon');
    removed += 1;
    console.log(`[${i}/${targets.length}] - ${brand.name} — Amazon delisted`);
  } else if (i % 25 === 0) {
    console.log(`[${i}/${targets.length}] …${brand.name}`);
  }

  // Written every brand so a long run can be stopped at any point.
  catalog.generatedAt = new Date().toISOString();
  writeFileSync(CATALOG, JSON.stringify(catalog));
}

await amazon.closeBrowser();
console.log(`\nDone. Added ${added}, removed ${removed}.`);
