import { gunzipSync } from 'node:zlib';
import { fetchText } from '../lib/http.mjs';
import { brandKey, htmlToBullets } from '../lib/html.mjs';

/**
 * CashKaro adapter.
 *
 * CashKaro is not a gift card seller — it pays cashback for clicking through to
 * a merchant. So it never becomes an `offer` alongside GyFTR/Woohoo/Amazon;
 * it hangs off the brand as a separate note. Mixing it into the seller panels
 * would put a cashback rate in the same column as a gift card discount, which
 * are different things bought in different places.
 *
 * Their store pages are Next.js and carry everything in `__NEXT_DATA__`.
 */

export const PLATFORM = {
  id: 'cashkaro',
  name: 'CashKaro',
  accent: '#7a3cff',
  initials: 'CK',
  logo: 'logos/cashkaro.png',
  homeUrl: 'https://cashkaro.com/',
};

const ORIGIN = 'https://cashkaro.com';
const SITEMAP = 'https://www.cashkaro.com/sitemap-stores_ck.xml.gz';

/**
 * Paths their robots.txt puts off limits. Mostly retired or duplicate store
 * pages ("-old", "-2017", "-exp-"), which are also exactly the pages that would
 * give us a dead rate, so honouring this improves the data as well.
 */
const DISALLOWED =
  /(^|-)(old\d*|inactive|tyroo|exclusive|ltng|gold|app)(-|$)|-\d*old|-20[0-2]\d|-exp-/i;

/** Slug decoration that isn't part of the brand name: "ajio-coupons" is AJIO. */
const SUFFIX = /-(coupons?|offers?|cashback|promo-codes?|deals?|discount-codes?|sale|store)$/;

/** Spelling differences between our catalog and theirs: "The Body Shop" is "body-shop". */
const keyVariants = (key) => {
  const out = new Set([key]);
  out.add(key.replace(/^the-/, ''));
  out.add(key.replace(/-/g, ''));
  out.add(key.replace(/^the-/, '').replace(/-/g, ''));
  out.add(key.replace(/-(india|in)$/, ''));
  return [...out].filter(Boolean);
};

let indexCache = null;
const INDEX_TTL_MS = 60 * 60 * 1000;

/** Slug -> store URL for every CashKaro store, keyed on every spelling variant. */
export async function loadStoreIndex() {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.index;

  const res = await fetch(SITEMAP, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; VaultlyBot/1.0)' },
  });
  if (!res.ok) throw new Error(`cashkaro sitemap HTTP ${res.status}`);

  const raw = Buffer.from(await res.arrayBuffer());
  // Served as a raw .gz file; some CDNs instead decompress it in transit.
  let xml;
  try {
    xml = gunzipSync(raw).toString('utf8');
  } catch {
    xml = raw.toString('utf8');
  }

  const index = new Map();
  for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
    const url = m[1];
    if (!url.includes('/stores/')) continue;
    const slug = url.split('/stores/')[1]?.replace(/\/$/, '');
    if (!slug || DISALLOWED.test(slug)) continue;

    const key = brandKey(slug.replace(SUFFIX, '').replace(/-/g, ' '));
    if (!key) continue;
    for (const v of keyVariants(key)) {
      if (!index.has(v)) index.set(v, { slug, url: `${ORIGIN}/stores/${slug}` });
    }
  }

  indexCache = { at: Date.now(), index };
  return index;
}

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * Which surfaces earn cashback.
 *
 * Taken from CashKaro's own sentence rather than inferred from the flags alone,
 * and the sentence travels with the answer so the page can show its working —
 * same rule as the gift card key facts: never state something the seller didn't.
 */
function derivePlatforms(attrs) {
  const note = String(attrs.tracking_info?.apporders_text ?? '').trim();
  const text = note.toLowerCase();

  if (/\bapp\s*(?:or|and|&|\/)\s*website\b|\bwebsite\s*(?:or|and|&|\/)\s*app\b/.test(text)) {
    return { platforms: 'both', note };
  }
  if (/only\s+applicable\s+on\b[^.]*\bwebsite\b|website\s+only|not\s+the\s+app/.test(text)) {
    return { platforms: 'website', note };
  }
  if (/only\s+applicable\s+on\b[^.]*\bapp\b|app\s+only|not\s+the\s+website/.test(text)) {
    return { platforms: 'app', note };
  }

  // No sentence to quote — fall back to the flag, which is weaker evidence.
  if (note === '') {
    if (String(attrs.app_orders).toLowerCase() === 'yes') return { platforms: 'both', note: null };
    if (String(attrs.app_orders).toLowerCase() === 'no') return { platforms: 'website', note: null };
  }
  return { platforms: 'unknown', note: note || null };
}

/**
 * Does paying with a gift card kill the cashback?
 *
 * The whole point of this site is buying a discounted gift card, so a merchant
 * that excludes gift-voucher payments from cashback cannot be stacked — and
 * that is the single most decision-changing line in CashKaro's terms here.
 * Myntra and Nykaa both carry it.
 */
function giftCardCaveat(lines) {
  for (const sentence of lines) {
    if (!/\b(gift\s*(?:card|voucher|certificate)s?|e-?gift|wallet|store\s*credits?)\b/i.test(sentence)) {
      continue;
    }
    if (/\b(exclud\w*|not\s+applicable|not\s+eligible|excluding|minus|after\s+deducting)\b/i.test(sentence)) {
      return sentence.trim();
    }
  }
  return null;
}

/**
 * Every published rate, not just the headline one.
 *
 * CashKaro's store page shows one rate up top and hides the rest behind "View
 * Cashback Rates". Air India's headline is ₹275 on international flights, but
 * there is a second published rate of ₹80 on domestic flights — showing only
 * the first understates what most buyers would actually get. The full table
 * lives in `included[].secondary_cashback`, already in the page payload.
 */
function rateRow(raw) {
  if (!raw) return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;
  return {
    type: raw.payment_type === 'percent' ? 'percent' : 'flat',
    amount,
    details: String(raw.details ?? '').trim() || null,
  };
}

function allRates(apiData) {
  const primary = rateRow(apiData?.data?.attributes?.cashback);
  const secondary = (apiData?.included ?? [])
    .flatMap((inc) => inc?.secondary_cashback ?? [])
    .map((s) => rateRow(s.attributes ?? s))
    .filter(Boolean);
  return [primary, ...secondary].filter(Boolean);
}

/**
 * A rate row that names gift cards and pays zero is the strongest possible
 * evidence that the two savings don't stack — stronger than the prose terms,
 * because it's CashKaro's own rate table. Amazon and Myntra both publish one.
 */
function zeroRatedGiftCardRow(rates) {
  return (
    rates.find(
      (r) =>
        r.amount === 0 &&
        /\bgift\s*(card|voucher|certificate)s?\b/i.test(r.details ?? ''),
    ) ?? null
  );
}

/** Read one CashKaro store page. Returns null when they don't carry the brand. */
export async function fetchStore({ url }) {
  const { body } = await fetchText(url);
  const apiData = nextData(body)?.props?.pageProps?.apiData;
  const attrs = apiData?.data?.attributes;
  if (!attrs?.name) return null;

  const cb = attrs.cashback ?? {};
  const amount = Number(cb.amount ?? 0);
  // `no_cashback_store` is the authoritative flag — these pages still render a
  // rate block, but with a "Visit X" button instead of "Earn Cashback on X".
  const active = Number(attrs.no_cashback_store) === 0 && amount > 0;

  // Where there's no cashback, "which surfaces earn it" has no answer to give.
  const rates = active ? allRates(apiData) : [];
  const zeroGiftCard = zeroRatedGiftCardRow(rates);

  const { platforms, note } = active
    ? derivePlatforms(attrs)
    : { platforms: 'unknown', note: null };
  // Their terms are list items with no full stops, so splitting on sentences
  // would treat the whole block as one and let any stray mention match.
  const terms = [
    ...htmlToBullets(attrs.terms_and_conditions ?? ''),
    ...htmlToBullets(attrs.final_terms_condition ?? ''),
  ];

  return {
    platformId: PLATFORM.id,
    name: attrs.name,
    storeUrl: url,
    active,
    rate: active
      ? {
          type: cb.payment_type === 'percent' ? 'percent' : 'flat',
          amount,
          // "Cashback on Home & Kitchen | Beauty (New Users)" — the rate often
          // applies to a slice of the catalogue only, so never show it bare.
          details: String(cb.details ?? '').trim() || null,
          wasAmount: Number(cb.strike_out_value) > amount ? Number(cb.strike_out_value) : null,
        }
      : null,
    /** Headline rate first, then every other published rate. */
    rates,
    platforms,
    platformNote: note,
    // Their own rate table beats their prose: a published 0% row naming gift
    // cards is proof, where the terms only imply it.
    giftCardCaveat: zeroGiftCard
      ? `CashKaro pays ${zeroGiftCard.type === 'percent' ? '0%' : '₹0'} here — “${zeroGiftCard.details}”.`
      : giftCardCaveat(terms),
    trackingSpeed: String(attrs.tracking_speed ?? '').trim() || null,
    confirmationDays: Number(attrs.expected_confirmation_days) || null,
    lastChecked: new Date().toISOString(),
  };
}

/** Find a brand on CashKaro and read its cashback, or null if they don't list it. */
export async function findBrand({ brandId, name }) {
  const index = await loadStoreIndex();
  for (const v of keyVariants(brandId || brandKey(name ?? ''))) {
    const hit = index.get(v);
    if (hit) return hit;
  }
  return null;
}

export async function fetchBrandCashback({ brandId, name }) {
  const hit = await findBrand({ brandId, name });
  if (!hit) return null;
  return fetchStore(hit);
}
