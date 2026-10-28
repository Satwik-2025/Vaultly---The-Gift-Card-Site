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
 *   node scripts/fill-amazon.mjs --refresh       # re-read the brands Amazon already has
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
/**
 * The routine refresh. Goes brand by brand the way a shopper would — search the
 * name, open the result — rather than opening product pages directly, which is
 * what Amazon's bot check kept interrupting. Paced, and it stops for good the
 * moment Amazon refuses: carrying on only prolongs the block.
 */
const refresh = argv.includes('--refresh');
const limit = flagValue('limit', Infinity);

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const amazonOffer = (b) => b.offers.find((o) => o.platformId === 'amazon');
const targets = catalog.brands
  .filter((b) => (refresh ? amazonOffer(b) : all || !amazonOffer(b)))
  // Oldest reading first, so a run that has to stop early still moved the
  // stalest prices forward.
  .sort((a, b) =>
    refresh
      ? String(amazonOffer(a).lastChecked ?? '').localeCompare(String(amazonOffer(b).lastChecked ?? ''))
      : 0,
  )
  .slice(0, limit);

console.log(`${targets.length} brand(s) to check on Amazon.\n`);

let added = 0;
let removed = 0;
let refreshed = 0;
let i = 0;

for (const brand of targets) {
  i += 1;
  const existing = amazonOffer(brand);
  if (refresh && i > 1) await amazon.politePause(4000, 9000);
  let result;
  try {
    result = await refreshSeller('amazon', brand, existing, new Date().toISOString());
  } catch (err) {
    console.log(`[${i}/${targets.length}] ${brand.name} — error: ${err.message}`);
    continue;
  }

  if (result.status === 'blocked') {
    console.log(`[${i}/${targets.length}] ${brand.name} — Amazon is showing a bot check. Stopping here so it doesn't get worse.`);
    break;
  }

  if (result.status === 'added' && result.offer) {
    brand.offers = [...brand.offers.filter((o) => o.platformId !== 'amazon'), result.offer].sort(
      (a, b) => b.headlineDiscountPct - a.headlineDiscountPct,
    );
    added += 1;
    console.log(`[${i}/${targets.length}] + ${brand.name} — Amazon ${result.offer.headlineDiscountPct}% (${result.offer.denominations.length} denoms)`);
  } else if (result.status === 'updated' && result.offer) {
    refreshed += 1;
    brand.offers = [...brand.offers.filter((o) => o.platformId !== 'amazon'), result.offer].sort(
      (a, b) => b.headlineDiscountPct - a.headlineDiscountPct,
    );
    console.log(`[${i}/${targets.length}] ~ ${brand.name} — Amazon ${result.offer.headlineDiscountPct}%`);
  } else if (result.status === 'gone') {
    brand.offers = brand.offers.filter((o) => o.platformId !== 'amazon');
    removed += 1;
    console.log(`[${i}/${targets.length}] - ${brand.name} — Amazon delisted`);
  } else if (refresh || i % 25 === 0) {
    console.log(`[${i}/${targets.length}] …${brand.name}`);
  }

  // Written every brand so a long run can be stopped at any point.
  catalog.generatedAt = new Date().toISOString();
  writeFileSync(CATALOG, JSON.stringify(catalog));
}

await amazon.closeBrowser();
console.log(`\nDone. Added ${added}, removed ${removed}${refreshed ? `, refreshed ${refreshed}` : ''}.`);
