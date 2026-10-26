import { brandKey } from './html.mjs';
import { stemOf } from './build.mjs';

/**
 * Locating one known brand on one seller.
 *
 * The scrape discovers brands in bulk; this answers the narrower question a
 * live re-check asks: "does *this* seller stock *this* brand right now?" It is
 * what lets a re-check add a seller that wasn't in the catalog before — the old
 * refresh could only revisit sellers a brand already had, so a card Amazon had
 * listed since the last full scrape stayed invisible forever.
 */

/** Sitemaps are big and change slowly; one walk serves every brand page for a while. */
const TTL_MS = 10 * 60 * 1000;
const caches = new Map();

/**
 * Does this product slug belong to `brandId`?
 *
 * Strict by design. A seller's search for "The Body Shop" also returns Bath &
 * Bodyworks and Health and Glow, so a loose substring test would attach a
 * rival's price to the wrong brand — worse than missing the card entirely.
 * `stemOf` is the one deliberate loosening: it lets Zee5's per-language packs
 * ("zee5-tamil-12m") match the parent brand they were folded into.
 */
export function matchesBrand(candidate, brandId, brandName) {
  const key = brandKey(String(candidate).replace(/[-_/]+/g, ' '));
  if (!key) return false;
  const wanted = new Set([brandId, brandKey(brandName ?? '')].filter(Boolean));
  if (wanted.has(key)) return true;
  const stem = stemOf(key);
  return Boolean(stem && wanted.has(stem));
}

/**
 * Find a brand among a seller's sitemap URLs, caching the sitemap between calls.
 * Used by the sellers that publish one — GyFTR and Woohoo. Amazon has no usable
 * sitemap, so it implements `findBrand` with a targeted search instead.
 */
export async function findViaSitemap(platformId, listBrandUrls, { brandId, name }) {
  let entry = caches.get(platformId);
  if (!entry || Date.now() - entry.at > TTL_MS) {
    entry = { at: Date.now(), urls: await listBrandUrls() };
    caches.set(platformId, entry);
  }
  return entry.urls.filter((u) => matchesBrand(u.slug, brandId, name));
}
