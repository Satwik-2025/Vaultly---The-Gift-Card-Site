/**
 * Fill in CashKaro cashback for every brand in the catalog.
 *
 * Cheap compared with the gift card sellers: one sitemap fetch, then one plain
 * HTTP page per brand that CashKaro actually lists. Brands they don't carry get
 * an explicit null so the UI can tell "no cashback" from "not checked yet".
 *
 *   node scripts/fill-cashkaro.mjs [--limit 50]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPool } from './lib/http.mjs';
import { loadStoreIndex, fetchBrandCashback } from './sources/cashkaro.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'public', 'catalog.json');

const argv = process.argv.slice(2);
const li = argv.indexOf('--limit');
const limit = li > -1 && argv[li + 1] ? Number(argv[li + 1]) : Infinity;

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const brands = catalog.brands.slice(0, limit);

await loadStoreIndex(); // warm the shared index once
console.log(`Checking ${brands.length} brand(s) on CashKaro…\n`);

let listed = 0;
let paying = 0;
let caveats = 0;

await mapPool(brands, 6, async (brand) => {
  try {
    const ck = await fetchBrandCashback({ brandId: brand.id, name: brand.name });
    brand.cashKaro = ck;
    if (!ck) return;
    listed += 1;
    if (ck.active) {
      paying += 1;
      if (ck.giftCardCaveat) caveats += 1;
      console.log(
        `  ${brand.name.padEnd(28).slice(0, 28)} ${String(ck.rate.amount) + (ck.rate.type === 'percent' ? '%' : '')}`.padEnd(40) +
          `${ck.platforms}${ck.giftCardCaveat ? '  ⚠ excludes gift vouchers' : ''}`,
      );
    }
  } catch {
    brand.cashKaro = brand.cashKaro ?? null;
  }
}, { gapMs: 120 });

catalog.generatedAt = new Date().toISOString();
writeFileSync(CATALOG, JSON.stringify(catalog));

console.log(
  `\nDone. ${listed} of ${brands.length} listed on CashKaro, ${paying} paying cashback, ${caveats} of those exclude gift vouchers.`,
);
