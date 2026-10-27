import * as gyftr from '../scripts/sources/gyftr.mjs';
import * as woohoo from '../scripts/sources/woohoo.mjs';
import * as amazon from '../scripts/sources/amazon.mjs';
import * as cashkaro from '../scripts/sources/cashkaro.mjs';
import { fetchText, mapPool } from '../scripts/lib/http.mjs';
import { readCatalog, update } from './catalog-store.mjs';

const SOURCES = { gyftr, woohoo, amazon };

/**
 * How many of a seller's pages to read at once.
 *
 * GyFTR and Woohoo are plain HTTP and take the higher number happily. Amazon is
 * driving real browser tabs through Playwright, so it stays low — more tabs
 * cost memory and are the quickest route to a CAPTCHA.
 */
const PAGE_CONCURRENCY = { gyftr: 8, woohoo: 8, amazon: 1 };

/**
 * Most pages of one seller to read in a single re-check.
 *
 * Amazon rate-limits hard, and a brand can carry a dozen ASINs; reading all of
 * them is the surest way to get throttled part-way through and end up with
 * nothing. The lowest-priced listings are the ones worth re-reading anyway.
 */
const PAGE_BUDGET = { amazon: 6 };

/** Serialise refreshes per brand so a double-click can't interleave writes. */
const inFlight = new Map();

/**
 * Merge several product pages from one seller into a single offer.
 *
 * An offer can span several pages — Woohoo lists Zee5 as ten subscription
 * packs, Amazon lists one brand under several ASINs — so denominations are
 * unioned across all of them. Keyed on value *and* label because four Zee5
 * packs all cost ₹699 and are different products.
 */
function mergeFetched(fetched, checkedAt) {
  const byValue = new Map();
  for (const { source, fresh } of fetched) {
    for (const d of fresh.denominations) {
      const label = d.label ?? source.label ?? null;
      const key = `${d.value}|${label ?? ''}`;
      const existing = byValue.get(key);
      // `sourceUrl` is what the buy button follows — a seller's listings can
      // carry different slabs, so the slab has to name its own page.
      if (!existing || d.discountPct > existing.discountPct) {
        byValue.set(key, { ...d, label, sourceUrl: source.url });
      }
    }
  }

  // The best-priced page supplies the terms and the headline figure.
  const primary = fetched.reduce((best, f) =>
    f.fresh.headlineDiscountPct > best.fresh.headlineDiscountPct ? f : best,
  );

  const denominations = [...byValue.values()].sort(
    (x, y) => x.value - y.value || String(x.label ?? '').localeCompare(String(y.label ?? '')),
  );

  const sources = fetched.map(({ source, fresh }) => ({
    url: source.url,
    label: source.label ?? fresh.denominations[0]?.label ?? null,
  }));

  return {
    ...primary.fresh,
    denominations,
    customAmount: fetched.find((f) => f.fresh.customAmount)?.fresh.customAmount ?? null,
    sources,
    listingCount: sources.length,
    lastChecked: checkedAt,
    verified: true,
  };
}

/**
 * Is a listing page gone, still live, or simply unreachable?
 *
 * Used only when a seller's pages yield nothing, to tell a pulled listing from
 * one that merely has no stock today. Unreachable counts as neither, so a blip
 * can never delete a seller.
 */
async function pageStatus(url) {
  try {
    const { status } = await fetchText(url, { retries: 0, timeoutMs: 10000 });
    if (status === 404 || status === 410) return 'missing';
    if (status >= 200 && status < 400) return 'live';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Re-read one seller for one brand, right now.
 *
 * Checks the pages this seller is already known to have *and* searches the
 * seller for the brand, so a card listed since the last full scrape gets picked
 * up. Previously this only revisited `offer.sources`, which meant a seller that
 * had never been recorded for a brand could never appear: Amazon has stocked
 * The Body Shop all along, but because the bulk sweep never surfaced it, no
 * amount of re-checking would ever find it.
 *
 * Returns a `status` the caller uses to decide between updating, adding and
 * delisting. The distinction that matters is `gone` vs `failed`: only a seller
 * that answered and genuinely has no listing may be removed. A CAPTCHA, a
 * timeout or a network blip must leave the existing panel alone.
 */
export async function refreshSeller(platformId, brand, offer, checkedAt) {
  const mod = SOURCES[platformId];
  if (!mod?.fetchBrand) return { status: 'failed', offer };

  // Where this seller is already known to list the brand.
  const known = offer
    ? (offer.sources?.length ? offer.sources : [{ url: offer.productUrl, label: null }])
    : [];

  /** Set when the seller is actively refusing us, rather than the page being bad. */
  let blocked = null;

  // Ask the seller where it lists the brand *now*, but don't wait for the
  // answer before reading the pages we already know about. Amazon's search is a
  // browser navigation costing several seconds, and running it before touching
  // the known pages made every re-check pay for it twice over.
  const searching = mod.findBrand
    ? mod
        .findBrand({ brandId: brand.id, name: brand.name })
        .then((hits) => ({ ok: true, hits: hits ?? [] }))
        .catch((err) => {
          // Unreachable or refused — never evidence of a delisting.
          if (err?.blocked) blocked ??= err.kind ?? 'blocked';
          return { ok: false, hits: [] };
        })
    : Promise.resolve({ ok: false, hits: [] });

  const fetched = [];
  const seen = new Set();
  let anyError = false;

  /**
   * Read a batch of this seller's pages at once. A brand can span twenty pages
   * (Zee5 on Woohoo), and reading those one after another was most of the wait.
   * Capped rather than unbounded — Amazon is driving real browser tabs, and
   * opening twenty at once is the quickest route to a CAPTCHA.
   */
  const readPages = async (sources) => {
    // Once a seller has started refusing, further requests only dig the hole
    // deeper and slow the page down for nothing.
    if (blocked) return;

    const budget = PAGE_BUDGET[platformId] ?? Infinity;
    const batch = sources
      .filter((t) => t?.url && !seen.has(t.url))
      .slice(0, Math.max(0, budget - seen.size));
    for (const t of batch) seen.add(t.url);
    if (!batch.length) return;

    const results = await mapPool(
      batch,
      PAGE_CONCURRENCY[platformId] ?? 6,
      async (source) => {
        try {
          const fresh = await mod.fetchBrand({
            slug: source.slug ?? offer?.slug,
            url: source.url,
            title: source.title,
          });
          return fresh?.offer ? { source: { ...source, label: source.label ?? null }, fresh: fresh.offer } : null;
        } catch (err) {
          // "They're blocking us" is a different answer from "this page is
          // broken", and the user is told which.
          if (err?.blocked) blocked ??= err.kind ?? 'blocked';
          anyError = true; // One dead page shouldn't discard the others.
          return null;
        }
      },
      // The bulk scrape paces itself politely; a single brand the user is
      // waiting on is a handful of requests, so the gap is only a courtesy.
      // Amazon is paced far more gently than the others; it throttles on
      // bursts, and a re-check that gets blocked is worth nothing.
      { gapMs: platformId === 'amazon' ? 600 : 40 },
    );

    // Keep input order so the merge is deterministic run to run.
    for (const r of results) if (r) fetched.push(r);
  };

  // The known pages and the search now overlap.
  const [, { ok: searchOk, hits: discovered }] = await Promise.all([
    readPages(known),
    searching,
  ]);

  // Anything the search turned up that we didn't already have.
  await readPages(discovered);

  if (!seen.size) {
    // Nothing known, nothing found. Only a successful search proves absence.
    return { status: searchOk ? 'absent' : 'failed', offer };
  }

  if (fetched.length) {
    const next = mergeFetched(fetched, checkedAt);
    return { status: offer ? 'updated' : 'added', offer: next };
  }

  // Blocked is never grounds for removing anything — keep what we had and say
  // plainly that these are the previous numbers.
  if (blocked) return { status: 'blocked', offer, blocked };

  // Every page came back empty. Before removing a seller, find out *why* —
  // "page is 404" and "page loads but sells nothing today" look identical from
  // here, and only the first is a delisting.
  if (offer && searchOk && !discovered.length && !anyError) {
    const urls = known.map((k) => k?.url).filter(Boolean);
    const statuses = await Promise.all(urls.map(pageStatus));

    // Pulled: every page we knew about is a hard 404/410.
    if (urls.length && statuses.every((s) => s === 'missing')) {
      return { status: 'gone', offer: null };
    }

    // Still published, but nothing to buy. GyFTR keeps Air India Domestic's
    // page up with an empty product list; deleting the seller over that would
    // lose a listing that comes back when they restock.
    if (statuses.some((s) => s === 'live')) {
      return {
        status: 'unstocked',
        offer: { ...offer, inStock: false, lastChecked: checkedAt },
      };
    }
  }
  return { status: 'failed', offer };
}

/**
 * Re-reads one brand across every seller we support, right now.
 *
 * The scheduled full scrape stays the source of breadth; this makes the brand
 * the user is actually looking at correct on the spot — right prices, sellers
 * that have started stocking it added, sellers that have dropped it removed.
 */
export async function refreshBrand(brandId) {
  if (inFlight.has(brandId)) return inFlight.get(brandId);

  const task = (async () => {
    // Snapshot for deciding what to fetch; the result is applied to a fresh
    // catalog under the lock, since the sync may write while we're fetching.
    const brand = readCatalog().brands.find((b) => b.id === brandId);
    if (!brand) throw Object.assign(new Error(`Unknown brand: ${brandId}`), { status: 404 });

    const checkedAt = new Date().toISOString();
    const byPlatform = new Map(brand.offers.map((o) => [o.platformId, o]));

    // Every seller, not just the ones already on record. CashKaro runs
    // alongside them but is not one of them — it's a cashback rate, not a card.
    const [results, cashKaro] = await Promise.all([
      Promise.all(
        Object.keys(SOURCES).map(async (platformId) => ({
          platformId,
          ...(await refreshSeller(platformId, brand, byPlatform.get(platformId), checkedAt)),
        })),
      ),
      cashkaro
        .fetchBrandCashback({ brandId: brand.id, name: brand.name })
        // A cashback lookup failing must never cost us the price check.
        .catch(() => brand.cashKaro ?? null),
    ]);

    brand.cashKaro = cashKaro;

    const changes = {
      added: [],
      removed: [],
      updated: [],
      unavailable: [],
      unstocked: [],
      blocked: [],
    };
    const offers = [];

    for (const r of results) {
      if (r.offer) offers.push(r.offer);
      if (r.status === 'added') changes.added.push(r.platformId);
      else if (r.status === 'updated') changes.updated.push(r.platformId);
      else if (r.status === 'gone') changes.removed.push(r.platformId);
      else if (r.status === 'unstocked') changes.unstocked.push(r.platformId);
      else if (r.status === 'blocked') changes.blocked.push(r.platformId);
      else if (r.status === 'failed' && byPlatform.has(r.platformId)) {
        // Kept on screen with its old timestamp, but say so rather than
        // passing stale numbers off as a fresh check.
        changes.unavailable.push(r.platformId);
      }
    }

    brand.offers = offers.sort((a, b) => b.headlineDiscountPct - a.headlineDiscountPct);

    // No seller stocks it any more — drop it so search stops offering a card
    // nobody sells. Only reachable-and-empty gets here; failures keep the brand.
    const delisted = brand.offers.length === 0;

    // Touch only this brand. Rewriting the whole snapshot we read minutes ago
    // would undo any delistings the catalog sync made in the meantime.
    await update((fresh) => {
      const i = fresh.brands.findIndex((b) => b.id === brandId);
      if (delisted) {
        if (i > -1) fresh.brands.splice(i, 1);
        return;
      }
      if (i > -1) fresh.brands[i] = brand;
      else {
        fresh.brands.push(brand);
        fresh.brands.sort((a, b) => a.name.localeCompare(b.name));
      }
    });

    return { brand, changes, delisted };
  })().finally(() => inFlight.delete(brandId));

  inFlight.set(brandId, task);
  return task;
}

/** Vite middleware: GET /api/refresh/:brandId */
export function refreshMiddleware() {
  return async (req, res, next) => {
    const match = req.url?.match(/^\/api\/refresh\/([^/?]+)/);
    if (!match) return next();

    res.setHeader('content-type', 'application/json');
    try {
      const { brand, changes, delisted } = await refreshBrand(decodeURIComponent(match[1]));
      res.end(JSON.stringify({ ok: true, brand, changes, delisted }));
    } catch (err) {
      res.statusCode = err?.status ?? 500;
      res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
    }
  };
}
