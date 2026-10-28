#!/usr/bin/env node
/**
 * Builds public/catalog.json from the live seller sites.
 *
 *   node scripts/scrape.mjs                     # everything (slow, a few minutes)
 *   node scripts/scrape.mjs --limit 40          # first 40 brands per source
 *   node scripts/scrape.mjs --only gyftr
 *   node scripts/scrape.mjs --brands dominos,healthkart
 *
 * Nothing here invents data: a field the seller doesn't publish comes out as
 * null or `status: "unknown"`, never as a plausible-looking guess.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapPool } from './lib/http.mjs';
import { merge } from './lib/build.mjs';
import { fillUnknownFacts } from './lib/facts.mjs';
import * as gyftr from './sources/gyftr.mjs';
import * as woohoo from './sources/woohoo.mjs';
import * as amazon from './sources/amazon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'catalog.json');

const SOURCES = { gyftr, woohoo, amazon };

// ---------------------------------------------------------------- CLI parsing
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const limit = Number(flag('limit', 0)) || 0;
const concurrency = Number(flag('concurrency', 6)) || 6;
const only = (flag('only') ?? '').split(',').filter(Boolean);
const brandFilter = (flag('brands') ?? '').split(',').filter(Boolean);

// ------------------------------------------------------------------ scraping
async function runSource(name, mod) {
  process.stdout.write(`\n[${name}] listing brands…\n`);
  let urls;
  try {
    urls = await mod.listBrandUrls();
  } catch (e) {
    console.error(`[${name}] could not list brands: ${e.message}`);
    return [];
  }

  if (brandFilter.length) {
    // Amazon's slug is an ASIN, so match the listing title too.
    urls = urls.filter((u) => {
      const haystack = `${u.slug} ${u.title ?? ''} ${u.offer?.brand ?? ''}`.toLowerCase();
      return brandFilter.some((b) => haystack.includes(b.toLowerCase()));
    });
  }
  if (limit) urls = urls.slice(0, limit);

  console.log(`[${name}] ${urls.length} candidate pages`);

  let ok = 0;
  let skipped = 0;
  // Amazon runs through a real browser and watches for bursts: one page at a
  // time, with a pause between them, and the moment it shows a bot check we
  // stop for the day rather than keep knocking.
  const gentle = name === 'amazon';
  const sourceConcurrency = gentle ? 1 : concurrency;
  let halted = false;

  const results = await mapPool(
    urls,
    sourceConcurrency,
    async (u) => {
      if (halted) return null;
      if (gentle) await mod.politePause?.();
      let brand;
      try {
        brand = await mod.fetchBrand(u);
      } catch (e) {
        if (!e?.blocked) throw e;
        halted = true;
        console.error(`
[${name}] ${e.kind} — stopping here so it doesn't get worse`);
        return null;
      }
      if (brand) ok++;
      else skipped++;
      return brand;
    },
    {
      onProgress: (done, total) => {
        if (done % 10 === 0 || done === total) {
          process.stdout.write(`\r[${name}] ${done}/${total} · ${ok} parsed · ${skipped} skipped   `);
        }
      },
    },
  );

  const failures = results.filter((r) => r?.error).length;
  console.log(`\n[${name}] done — ${ok} brands, ${skipped} skipped, ${failures} errors`);
  return results.filter((r) => r && !r.error);
}

// ---------------------------------------------------------------------- main
const chosen = Object.entries(SOURCES).filter(([n]) => !only.length || only.includes(n));

const collected = [];
const platforms = [];
for (const [name, mod] of chosen) {
  platforms.push(mod.PLATFORM);
  collected.push(...(await runSource(name, mod)));
  // Amazon holds a browser open; release it as soon as that source is done.
  await mod.closeBrowser?.();
}

let brands = merge(collected);

const refreshedPlatformIds = new Set(platforms.map((p) => p.id));
const isPartialRun = only.length > 0 || brandFilter.length > 0;

/**
 * A partial run must not delete everything it didn't look at. Offers from
 * sellers this run *did* cover are replaced; everything else is carried over
 * from the previous catalog untouched.
 */
if (isPartialRun && existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));
  const freshIds = new Set(brands.map((b) => b.id));

  // Which brands may have this seller's offers replaced?
  //
  // A whole-seller run (`--only gyftr`) covered every brand, so an offer that
  // didn't come back has been delisted and should go. A `--brands`/`--limit` run
  // only looked at a handful, so stripping the seller everywhere would delete
  // every brand it didn't happen to visit — which silently cut the catalog from
  // 555 brands to 331.
  const narrowRun = brandFilter.length > 0 || limit > 0;

  const byId = new Map(
    prev.brands.map((b) => [
      b.id,
      {
        ...b,
        offers:
          (narrowRun && !freshIds.has(b.id)
            ? b.offers
            : b.offers.filter((o) => !refreshedPlatformIds.has(o.platformId))
          ).map(fillUnknownFacts),
      },
    ]),
  );

  for (const fresh of brands) {
    const existing = byId.get(fresh.id);
    if (existing) {
      // Take the *fresh* metadata — category, tagline, keywords are all derived,
      // so a rule fix (BigBasket: Food & Beverage -> Grocery) must apply on a
      // partial run too. Only the carried-over offers come from the old record.
      byId.set(fresh.id, { ...fresh, offers: [...existing.offers, ...fresh.offers] });
    } else {
      byId.set(fresh.id, fresh);
    }
  }

  brands = [...byId.values()]
    .filter((b) => b.offers.length)
    .map((b) => ({
      ...b,
      offers: [...b.offers].sort((x, y) => y.headlineDiscountPct - x.headlineDiscountPct),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Keep platform definitions for sellers this run didn't touch.
  for (const p of prev.platforms ?? []) {
    if (!refreshedPlatformIds.has(p.id)) platforms.push(p);
  }

  console.log(`\nPartial run — merged ${[...refreshedPlatformIds].join(', ')} into the existing catalog.`);
}

/**
 * Carry CashKaro cashback across the scrape.
 *
 * `merge()` builds brands from the gift card sellers only, so without this a
 * full run would silently wipe every brand's cashback (and a partial run would
 * too, since fresh metadata is spread over the old record). CashKaro is
 * refreshed on its own schedule by `npm run fill:cashkaro` and by opening a
 * brand page.
 */
if (existsSync(OUT)) {
  const prevCashKaro = new Map(
    JSON.parse(readFileSync(OUT, 'utf8'))
      .brands.filter((b) => b.cashKaro !== undefined)
      .map((b) => [b.id, b.cashKaro]),
  );
  if (prevCashKaro.size) {
    brands = brands.map((b) =>
      prevCashKaro.has(b.id) ? { ...b, cashKaro: prevCashKaro.get(b.id) } : b,
    );
    console.log(`Carried CashKaro cashback for ${prevCashKaro.size} brand(s).`);
  }
}

const multi = brands.filter((b) => b.offers.length > 1).length;
const factStats = { good: 0, limited: 0, bad: 0, unknown: 0 };
for (const b of brands)
  for (const o of b.offers)
    for (const f of Object.values(o.keyFacts)) factStats[f.status] = (factStats[f.status] ?? 0) + 1;

const catalog = {
  generatedAt: new Date().toISOString(),
  sources: platforms.map((p) => ({ id: p.id, name: p.name, homeUrl: p.homeUrl })),
  platforms,
  brands,
};

mkdirSync(dirname(OUT), { recursive: true });

// Don't let a failed/partial run destroy a good catalog.
if (brands.length === 0) {
  console.error('\nNo brands scraped — leaving the existing catalog.json untouched.');
  process.exit(1);
}
if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'));

  const countByPlatform = (list) => {
    const n = {};
    for (const b of list ?? []) for (const o of b.offers) n[o.platformId] = (n[o.platformId] ?? 0) + 1;
    return n;
  };
  const before = countByPlatform(prev.brands);
  const after = countByPlatform(brands);

  // A seller that got blocked mid-run returns almost nothing. Catch that per
  // seller — a total-count check misses it, because the healthy sellers hide
  // the collapse (Amazon once fell from 184 offers to 1 and slipped through).
  // Only meaningful for runs that intended full coverage — a `--brands` or
  // `--limit` run is *supposed* to return a fraction of the catalog.
  const collapsed =
    brandFilter.length || limit
      ? []
      : [...refreshedPlatformIds].filter(
          (id) => (before[id] ?? 0) >= 20 && (after[id] ?? 0) < (before[id] ?? 0) * 0.5,
        );

  if (collapsed.length) {
    console.error('\nRefusing to overwrite — these sellers returned far less than last time:');
    for (const id of collapsed) console.error(`  ${id}: ${before[id]} offers -> ${after[id] ?? 0}`);
    console.error('They are probably rate-limiting or serving a bot check. Re-run later,');
    console.error('or pass --force if the drop is genuine.');
    if (!argv.includes('--force')) process.exit(1);
  }

  if (!limit && !brandFilter.length && prev.brands?.length > brands.length * 2) {
    console.error(
      `\nRefusing to overwrite: previous catalog had ${prev.brands.length} brands, this run got ${brands.length}.`,
    );
    console.error('Re-run when the sites are responding, or pass --force to override.');
    if (!argv.includes('--force')) process.exit(1);
  }
}

writeFileSync(OUT, JSON.stringify(catalog));

console.log(`\n─────────────────────────────────────────`);
console.log(`brands              ${brands.length}`);
console.log(`  on >1 seller      ${multi}`);
console.log(`offers              ${brands.reduce((n, b) => n + b.offers.length, 0)}`);
console.log(`key facts           ${factStats.good} good · ${factStats.limited} limited · ${factStats.bad} bad · ${factStats.unknown} unknown`);
console.log(`written             ${OUT}`);
