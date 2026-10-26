import type { Brand, Catalog, Category, Offer, Platform, PlatformId } from '../types';

/**
 * Single access point for catalog data.
 *
 * The catalog is fetched once from `/catalog.json` (produced by
 * `npm run scrape`) before the app renders, so every accessor below stays
 * synchronous and components need no loading states of their own.
 */

let catalog: Catalog | null = null;
let platformIndex = new Map<PlatformId, Platform>();

const FALLBACK_PLATFORM = (id: PlatformId): Platform => ({
  id,
  name: id,
  tagline: '',
  accent: '#8b8bff',
  initials: id.slice(0, 2).toUpperCase(),
  homeUrl: '#',
});

export async function loadCatalog(): Promise<Catalog> {
  // `import.meta.env.BASE_URL` keeps this correct under a sub-path deployment.
  const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load catalog.json (HTTP ${res.status})`);

  const data = (await res.json()) as Catalog;
  if (!Array.isArray(data.brands) || data.brands.length === 0) {
    throw new Error('catalog.json contains no brands — run `npm run scrape`.');
  }

  catalog = data;
  platformIndex = new Map(data.platforms.map((p) => [p.id, p]));
  return data;
}

/** What a live re-check changed, so the page can say so instead of silently moving. */
export interface RefreshChanges {
  /** Sellers that have started stocking this brand since the last check. */
  added: PlatformId[];
  /** Sellers that have dropped it. */
  removed: PlatformId[];
  updated: PlatformId[];
  /** Sellers that couldn't be reached — their panel is still the old reading. */
  unavailable: PlatformId[];
  /** Still listed, but with nothing in stock to buy today. */
  unstocked: PlatformId[];
}

export interface RefreshResult {
  brand: Brand;
  changes: RefreshChanges;
  /** True when no seller stocks it any more and it left the catalog. */
  delisted: boolean;
}

/**
 * Re-reads one brand from every seller we support, live, via the dev-server
 * endpoint. Falls back loudly rather than silently showing stale numbers.
 *
 * This checks every seller, not only the ones already on record, so a card a
 * seller has listed since the last full scrape appears here — and one that has
 * been dropped disappears.
 */
export async function refreshBrandLive(brandId: string): Promise<RefreshResult> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/refresh/${encodeURIComponent(brandId)}`);
  const data = (await res.json().catch(() => null)) as
    | { ok: boolean; brand?: Brand; changes?: RefreshChanges; delisted?: boolean; error?: string }
    | null;

  if (!res.ok || !data?.ok || !data.brand) {
    throw new Error(data?.error ?? `Live check failed (HTTP ${res.status})`);
  }

  // Keep the in-memory catalog in step so search and the home page agree with
  // what the brand page is showing.
  if (catalog) {
    const i = catalog.brands.findIndex((b) => b.id === brandId);
    if (data.delisted) {
      if (i > -1) catalog.brands.splice(i, 1);
    } else if (i > -1) {
      catalog.brands[i] = data.brand;
    } else {
      catalog.brands.push(data.brand);
      catalog.brands.sort((a, b) => a.name.localeCompare(b.name));
    }
    catalog.generatedAt = new Date().toISOString();
  }

  return {
    brand: data.brand,
    changes: data.changes ?? {
      added: [],
      removed: [],
      updated: [],
      unavailable: [],
      unstocked: [],
    },
    delisted: Boolean(data.delisted),
  };
}

export interface DiscoveryResult {
  added: number;
  /** Offers removed because the seller has pulled the listing. */
  removed: number;
  brands: { id: string; name: string; newSellers: string[] }[];
  removedBrands: { id: string; name: string; gone: boolean }[];
}

/**
 * Asks the server which cards the sellers currently list, folding new arrivals
 * into the catalog and dropping ones that have been pulled.
 *
 * Deliberately a presence check, not a price check: it reads each seller's
 * sitemap and only opens the handful of pages that look delisted, so opening
 * the site stays fast. Prices are re-read per brand, on the brand page.
 *
 * Discovery itself is one sitemap fetch per seller, so this is cheap; the server
 * also rate-limits itself so repeated page views don't re-walk them. Resolves
 * with `added: 0` when there's nothing new, or when no live server is present
 * (a statically-hosted build).
 */
/**
 * One discovery per page load, shared by every caller.
 *
 * StrictMode invokes effects twice in development: without this the first call
 * did the work and the second came back rate-limited with `added: 0` — and the
 * second is the one whose result survives, so the banner never appeared.
 */
let discovery: Promise<DiscoveryResult> | null = null;

export function discoverNewCards(): Promise<DiscoveryResult> {
  discovery ??= runDiscovery();
  return discovery;
}

async function runDiscovery(): Promise<DiscoveryResult> {
  const empty: DiscoveryResult = { added: 0, removed: 0, brands: [], removedBrands: [] };
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/discover`);
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      ok?: boolean;
      added?: number;
      removed?: number;
      brands?: DiscoveryResult['brands'];
      removedBrands?: DiscoveryResult['removedBrands'];
    };
    if (!data?.ok || (!data.added && !data.removed)) return empty;

    // Pull the rewritten catalog rather than patching it client-side.
    await loadCatalog();
    return {
      added: data.added ?? 0,
      removed: data.removed ?? 0,
      brands: data.brands ?? [],
      removedBrands: data.removedBrands ?? [],
    };
  } catch {
    return empty;
  }
}

const store = (): Catalog => {
  if (!catalog) throw new Error('Catalog accessed before loadCatalog() resolved');
  return catalog;
};

export const generatedAt = (): string => store().generatedAt;

export const listBrands = (): Brand[] => store().brands;

export const listPlatforms = (): Platform[] => store().platforms;

export const getPlatform = (id: PlatformId): Platform =>
  platformIndex.get(id) ?? FALLBACK_PLATFORM(id);

export const getBrand = (id: string): Brand | undefined =>
  store().brands.find((b) => b.id === id);

/** Alphabetical, except "Other" is always pinned last — it's the fallback bucket. */
export const listCategories = (): Category[] =>
  [...new Set(store().brands.map((b) => b.category))].sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

/** Offers in a stable seller order so panels never jump around. */
export const orderedOffers = (brand: Brand): Offer[] => {
  const order = store().platforms.map((p) => p.id);
  return [...brand.offers].sort(
    (a, b) => order.indexOf(a.platformId) - order.indexOf(b.platformId),
  );
};

export const bestDiscount = (brand: Brand): number =>
  brand.offers.reduce((n, o) => Math.max(n, o.headlineDiscountPct), 0);

export const bestOffer = (brand: Brand): Offer | undefined =>
  brand.offers.reduce<Offer | undefined>(
    (best, o) => (!best || o.headlineDiscountPct > best.headlineDiscountPct ? o : best),
    undefined,
  );

/** Offers ranked best-discount-first, for the strip under a search result. */
export const rankedOffers = (brand: Brand): Offer[] =>
  [...brand.offers].sort((a, b) => b.headlineDiscountPct - a.headlineDiscountPct);

export const payable = (value: number, discountPct: number): number =>
  Math.round(value * (1 - discountPct / 100));

export const savings = (value: number, discountPct: number): number =>
  value - payable(value, discountPct);

export const maxSaving = (offer: Offer): number => {
  const slabs = offer.denominations.reduce((n, d) => Math.max(n, savings(d.value, d.discountPct)), 0);
  const open = offer.customAmount
    ? savings(offer.customAmount.max, offer.customAmount.discountPct)
    : 0;
  return Math.max(slabs, open);
};

/** How many of the four key questions this offer actually answers. */
export const factCoverage = (offer: Offer): number =>
  Object.values(offer.keyFacts).filter((f) => f.status !== 'unknown').length;

/**
 * Strip everything that isn't a letter or digit, so spelling variations that
 * only differ in spacing or punctuation still match: "big basket" finds
 * BigBasket, "dominos" finds Domino's, "zee 5" finds Zee5.
 */
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function score(brand: Brand, q: string): number {
  const name = brand.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 85;
  if (name.includes(q)) return 65;

  // Same checks again, ignoring spaces and punctuation on both sides.
  const sq = squash(q);
  if (sq.length >= 3) {
    const sName = squash(brand.name);
    if (sName === sq) return 95;
    if (sName.startsWith(sq)) return 80;
    if (sName.includes(sq)) return 60;
    if (brand.keywords.some((k) => squash(k).startsWith(sq))) return 40;
    if (brand.keywords.some((k) => squash(k).includes(sq))) return 20;
  }

  if (brand.keywords.some((k) => k.startsWith(q))) return 40;
  if (brand.category.toLowerCase().includes(q)) return 30;
  if (brand.keywords.some((k) => k.includes(q))) return 20;
  return 0;
}

/**
 * Ranked search across name, keywords and category.
 * An empty query returns everything, best discount first.
 */
export function searchBrands(query: string): Brand[] {
  const q = query.trim().toLowerCase();
  const brands = store().brands;

  if (!q) return [...brands].sort((a, b) => bestDiscount(b) - bestDiscount(a));

  return brands
    .map((brand) => ({ brand, s: score(brand, q) }))
    .filter((r) => r.s > 0)
    .sort(
      (a, b) =>
        b.s - a.s ||
        b.brand.offers.length - a.brand.offers.length ||
        bestDiscount(b.brand) - bestDiscount(a.brand),
    )
    .map((r) => r.brand);
}

export const suggestBrands = (query: string, limit = 6): Brand[] =>
  searchBrands(query).slice(0, limit);

export const formatINR = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

export const formatPct = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
