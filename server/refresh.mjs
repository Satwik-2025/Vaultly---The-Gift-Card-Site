import * as gyftr from '../scripts/sources/gyftr.mjs';
import * as woohoo from '../scripts/sources/woohoo.mjs';
import * as amazon from '../scripts/sources/amazon.mjs';
import * as cashkaro from '../scripts/sources/cashkaro.mjs';
import { readCatalog, update } from './catalog-store.mjs';
import { computeRefresh, refreshSellerWith } from './refresh-core.mjs';

/**
 * The local re-check: every seller including Amazon (it has a real browser to
 * drive here), with the result written back to catalog.json. The deployed
 * site uses the same core from api/refresh/[brandId].mjs, minus Amazon and
 * minus the write.
 */
const SOURCES = { gyftr, woohoo, amazon };

/** Serialise refreshes per brand so a double-click can't interleave writes. */
const inFlight = new Map();

/** One seller for one brand. Used by scripts/fill-amazon.mjs. */
export const refreshSeller = (platformId, brand, offer, checkedAt) =>
  refreshSellerWith(SOURCES[platformId], platformId, brand, offer, checkedAt);

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

    const result = await computeRefresh({ brand, sources: SOURCES, cashkaro });

    // Touch only this brand. Rewriting the whole snapshot we read minutes ago
    // would undo any delistings the catalog sync made in the meantime.
    await update((fresh) => {
      const i = fresh.brands.findIndex((b) => b.id === brandId);
      if (result.delisted) {
        if (i > -1) fresh.brands.splice(i, 1);
        return;
      }
      if (i > -1) fresh.brands[i] = result.brand;
      else {
        fresh.brands.push(result.brand);
        fresh.brands.sort((a, b) => a.name.localeCompare(b.name));
      }
    });

    return result;
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
