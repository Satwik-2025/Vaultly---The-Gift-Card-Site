import { mapPool } from '../scripts/lib/http.mjs';
import { readCatalog, update } from './catalog-store.mjs';
import { merge } from '../scripts/lib/build.mjs';
import * as gyftr from '../scripts/sources/gyftr.mjs';
import * as woohoo from '../scripts/sources/woohoo.mjs';

/**
 * Catalog sync, run when someone opens the site.
 *
 * This answers "which cards exist?", not "what do they cost?" — it adds cards
 * the sellers have listed since the last scrape and removes ones they've
 * pulled. Prices are deliberately left alone: re-reading 700 product pages on
 * every page view would be slow and pointless, and the brand page re-reads its
 * own prices the moment you open it.
 *
 * Amazon is excluded. It needs a real browser and publishes no usable sitemap,
 * so there's no cheap way to enumerate what it still stocks; the daily scrape
 * and the per-brand live check cover it.
 */
const SOURCES = { gyftr, woohoo };

/** Don't re-walk the sitemaps on every single page view. */
const MIN_INTERVAL_MS = 10 * 60 * 1000;
/** Cap the work a single check can do, so one visit can't take minutes. */
const MAX_NEW_BRANDS = 25;
/**
 * Cap on delisting checks per run. A seller dropping a handful of cards is
 * normal; a sitemap that suddenly omits hundreds means their sitemap broke, not
 * that they shut the shop — and in that case we should do nothing at all.
 */
const MAX_REMOVAL_CHECKS = 40;
/** Above this share of a seller's offers going missing, assume a bad sitemap. */
const SITEMAP_SANITY_RATIO = 0.25;

let lastRun = 0;
let inFlight = null;

/**
 * Which of this seller's offers are no longer in its sitemap?
 *
 * Sitemap absence is the seller's own statement that a listing is gone, and
 * it's one fetch for the whole catalogue. It is not proof on its own though:
 * GyFTR leaves delisted product pages up and still serving HTTP 200, so the
 * candidates get verified by actually reading them before anything is removed.
 */
function missingFromSitemap(brands, platformId, liveUrls) {
  const candidates = [];
  let total = 0;

  for (const brand of brands) {
    for (const offer of brand.offers) {
      if (offer.platformId !== platformId) continue;
      total += 1;
      const urls = (offer.sources?.length ? offer.sources : [{ url: offer.productUrl }])
        .map((s) => s.url)
        .filter(Boolean);
      // Still listed if *any* of its pages is in the sitemap — a merged offer
      // can lose one variant without the brand itself going away.
      if (!urls.some((u) => liveUrls.has(u))) candidates.push({ brand, offer, urls });
    }
  }

  return { candidates, total };
}

export async function discoverNew({ force = false } = {}) {
  if (inFlight) return inFlight;

  const since = Date.now() - lastRun;
  if (!force && since < MIN_INTERVAL_MS) {
    return {
      ok: true,
      skipped: 'checked recently',
      nextCheckInMs: MIN_INTERVAL_MS - since,
      added: 0,
      removed: 0,
    };
  }

  inFlight = (async () => {
    // A read-only snapshot for deciding what to do. Nothing is written from
    // it — the decisions are re-applied to a fresh catalog under the lock,
    // because the network work below takes long enough for the per-brand
    // refresh to have written in the meantime.
    const catalog = readCatalog();

    // Every product URL already represented, across all sources of every offer.
    const known = new Set();
    for (const brand of catalog.brands) {
      for (const offer of brand.offers) {
        known.add(offer.productUrl);
        for (const s of offer.sources ?? []) known.add(s.url);
      }
    }

    const newEntries = [];
    const perSeller = {};
    const sitemaps = {};

    for (const [name, mod] of Object.entries(SOURCES)) {
      let urls;
      try {
        urls = await mod.listBrandUrls();
      } catch {
        perSeller[name] = { error: 'could not list' };
        continue;
      }

      sitemaps[name] = new Set(urls.map((u) => u.url));

      const unseen = urls.filter((u) => !known.has(u.url)).slice(0, MAX_NEW_BRANDS);
      perSeller[name] = { candidates: unseen.length };
      if (!unseen.length) continue;

      const fetched = await mapPool(unseen, 4, (u) => mod.fetchBrand(u), { gapMs: 150 });
      newEntries.push(...fetched.filter((r) => r && !r.error));
    }

    // ---- Removals: cards the sellers have pulled -------------------------
    const removedBrands = [];
    /** `platformId|productUrl` of each offer confirmed gone. */
    const dropped = new Set();

    for (const [name, mod] of Object.entries(SOURCES)) {
      const liveUrls = sitemaps[name];
      if (!liveUrls?.size) continue;

      const { candidates, total } = missingFromSitemap(catalog.brands, name, liveUrls);
      perSeller[name] = { ...perSeller[name], listed: total, missing: candidates.length };

      if (!candidates.length) continue;

      // A sitemap that lost a quarter of its entries is a broken sitemap.
      if (total && candidates.length / total > SITEMAP_SANITY_RATIO) {
        perSeller[name].skippedRemovals = `${candidates.length}/${total} missing — treating the sitemap as unreliable`;
        continue;
      }

      const toCheck = candidates.slice(0, MAX_REMOVAL_CHECKS);

      // Verify by reading the page: a delisted GyFTR card still returns 200,
      // it just no longer parses to anything buyable.
      const verdicts = await mapPool(
        toCheck,
        6,
        async ({ urls }) => {
          for (const url of urls) {
            try {
              const r = await mod.fetchBrand({ url, slug: url.split('/').pop() });
              if (r?.offer) return 'alive';
            } catch {
              return 'unknown'; // Network trouble is never evidence of removal.
            }
          }
          return 'gone';
        },
        { gapMs: 60 },
      );

      const tally = { gone: 0, alive: 0, unknown: 0 };
      toCheck.forEach(({ offer }, i) => {
        tally[verdicts[i]] = (tally[verdicts[i]] ?? 0) + 1;
        if (verdicts[i] === 'gone') dropped.add(`${offer.platformId}|${offer.productUrl}`);
      });
      perSeller[name].verified = tally;
      console.log(
        `[sync] ${name}: ${total} listed, ${candidates.length} missing from sitemap → ` +
          `${tally.gone} gone, ${tally.alive} still live, ${tally.unknown} unreachable`,
      );
    }

    // Only start the clock if we actually managed to read a seller. A sitemap
    // that times out on a cold start would otherwise count as "checked" and
    // block the next attempt for ten minutes, having synced nothing.
    const readAnySeller = Object.keys(sitemaps).length > 0;
    if (readAnySeller) lastRun = Date.now();

    const built = newEntries.length ? merge(newEntries) : [];

    if (!dropped.size && !built.length) {
      return {
        ok: true,
        added: 0,
        removed: 0,
        brands: [],
        removedBrands: [],
        perSeller,
        // Lets the caller tell "nothing changed" from "we couldn't check".
        checked: readAnySeller,
      };
    }

    // Everything above was decided against a snapshot. Apply it to a freshly
    // read catalog inside the lock, so a price refresh that landed in the
    // meantime keeps its prices and still loses the delisted cards.
    const addedBrands = [];

    await update((fresh) => {
      if (dropped.size) {
        for (const brand of fresh.brands) {
          const before = brand.offers.length;
          brand.offers = brand.offers.filter(
            (o) => !dropped.has(`${o.platformId}|${o.productUrl}`),
          );
          if (brand.offers.length !== before) {
            removedBrands.push({
              id: brand.id,
              name: brand.name,
              gone: brand.offers.length === 0,
            });
          }
        }
        // A brand nobody stocks any more shouldn't stay searchable.
        fresh.brands = fresh.brands.filter((b) => b.offers.length > 0);
      }

      if (built.length) {
        // A brand-new *plan* of an existing brand won't fold into that brand
        // here — that needs the full scrape, which sees all its siblings.
        const existing = new Map(fresh.brands.map((b) => [b.id, b]));

        for (const brand of built) {
          const prior = existing.get(brand.id);
          if (prior) {
            // Brand already known, but a seller that didn't stock it now does.
            const seen = new Set(prior.offers.map((o) => o.platformId));
            const extra = brand.offers.filter((o) => !seen.has(o.platformId));
            if (!extra.length) continue;
            prior.offers = [...prior.offers, ...extra].sort(
              (a, b) => b.headlineDiscountPct - a.headlineDiscountPct,
            );
            addedBrands.push({
              id: brand.id,
              name: brand.name,
              newSellers: extra.map((o) => o.platformId),
            });
          } else {
            existing.set(brand.id, brand);
            addedBrands.push({
              id: brand.id,
              name: brand.name,
              newSellers: brand.offers.map((o) => o.platformId),
            });
          }
        }

        fresh.brands = [...existing.values()];
      }

      fresh.brands.sort((a, b) => a.name.localeCompare(b.name));
      console.log(
        `[sync] ${fresh.brands.length} brands ` +
          `(+${addedBrands.length} added, -${removedBrands.length} removed)`,
      );
    });

    return {
      ok: true,
      added: addedBrands.length,
      removed: removedBrands.length,
      brands: addedBrands,
      removedBrands,
      perSeller,
    };
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Vite middleware: GET /api/discover[?force=1] */
export function discoverMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/discover')) return next();

    res.setHeader('content-type', 'application/json');
    try {
      const result = await discoverNew({ force: /[?&]force=1/.test(req.url) });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
    }
  };
}
