import { fetchText, extractSitemapUrls } from '../lib/http.mjs';
import { htmlToBullets, htmlToSteps, htmlToText, cleanBrandName, brandKey } from '../lib/html.mjs';
import { deriveKeyFacts } from '../lib/facts.mjs';
import { findViaSitemap } from '../lib/find.mjs';

export const PLATFORM = {
  id: 'woohoo',
  name: 'Woohoo',
  tagline: 'Pine Labs gift card marketplace · in-store and online brands',
  accent: '#7b5cff',
  initials: 'WH',
  logo: 'logos/woohoo.png',
  homeUrl: 'https://www.woohoo.in/',
};

const ORIGIN = 'https://www.woohoo.in';

export async function listBrandUrls() {
  const { body } = await fetchText(`${ORIGIN}/sitemap.xml`);
  return extractSitemapUrls(body)
    .filter((u) => u.startsWith(ORIGIN))
    .map((u) => u.replace(`${ORIGIN}/`, '').replace(/\/$/, ''))
    // The sitemap repeats every product under a dozen browse paths
    // (/brands/…, /by-category/…). Only the root-level URL is canonical.
    .filter((slug) => slug && !slug.includes('/'))
    .filter((slug) => /(e-gift|instant-voucher|gift-card|gift-voucher|egv)/i.test(slug))
    .map((slug) => ({ slug, url: `${ORIGIN}/${slug}` }));
}

/** Does Woohoo stock this brand right now? Matched against their sitemap. */
export async function findBrand({ brandId, name }) {
  return findViaSitemap(PLATFORM.id, listBrandUrls, { brandId, name });
}

/**
 * Extract a balanced JSON object literal starting at the first `{` after `from`.
 * `window.__INITIAL_STATE = {...}` isn't wrapped in a script tag we can slice on,
 * so we have to walk the braces (string-aware) to find its end.
 */
function balancedJson(src, from) {
  const start = src.indexOf('{', from);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

function productState(html) {
  const i = html.indexOf('window.__INITIAL_STATE');
  if (i === -1) return null;
  const raw = balancedJson(html, i);
  if (!raw) return null;
  try {
    return JSON.parse(raw).appReducer?.product ?? null;
  } catch {
    return null;
  }
}

/**
 * `offerShortDesc` ("10% Discount", "0.5% Discount") is the seller's own
 * figure. The page <title> is NOT usable — Woohoo leaves stale marketing copy
 * there, e.g. the Amazon Pay card whose title claims "Flat 50% Off" while the
 * product actually gives 0.5%.
 */
function discountFrom(product) {
  const desc = String(product.offerShortDesc ?? '');
  const m = desc.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/);
  if (!m) return { discountPct: 0, bonusPct: 0 };
  const pct = Number(m[1]);
  // "Get 8% Extra" is bonus value, not money off: ₹1,000 buys a ₹1,080 card.
  // As a discount on the card's value that's 8/108 = 7.4% — the figure the
  // comparison ranks by. The 8% is kept too, so the page can say it as Woohoo does.
  if (/extra/i.test(desc)) {
    return { discountPct: Math.round((pct / (100 + pct)) * 1000) / 10, bonusPct: pct };
  }
  return { discountPct: pct, bonusPct: 0 };
}

/**
 * Woohoo's "Offers for you" strip, from `product.campaigns`.
 *
 * These are real, currently-live discounts that `offerShortDesc` knows nothing
 * about: the Air India card has no card discount at all, yet pays 6% with UPI
 * (code WOOHOO) and 5% on debit cards (WOOHOODC). Reading only
 * `offerShortDesc` reported that card as "no discount", which is wrong.
 *
 * Conditional on a payment method and a coupon code, so they stay out of the
 * headline figure and are shown as their own thing.
 */
function paymentOffersFrom(product) {
  const now = Date.now();

  return (product.campaigns ?? [])
    .map((c) => {
      const action = (c.actions ?? []).find((a) => a.valueType === 'PERCENTAGE') ?? c.actions?.[0];
      if (!action) return null;

      const value = Number(action.value);
      if (!Number.isFinite(value) || value <= 0) return null;

      // Woohoo leaves expired campaigns in the payload; a date window that has
      // closed would put a dead offer on the page.
      const start = Date.parse(c.startDate);
      const end = Date.parse(c.endDate);
      if (Number.isFinite(start) && start > now) return null;
      if (Number.isFinite(end) && end < now) return null;

      const cap = Number(action.maxValue);

      /*
        The description carries the conditions the title leaves out. RuPay's
        "Get 90% Discount" is, in full: code FIRST, UPI, ₹10 order value only,
        once, new customers only — a ₹9 saving, not 90% off any card.
      */
      const text = `${c.description ?? ''} ${c.shortDescription ?? ''}`;
      const onlyValue = text.match(/on\s+(?:rs\.?|₹)\s*([\d,]+)\s*order\s*value/i)?.[1];
      const newOnly = /new\s+(users?|customers?)/i.test(text);
      const once = /once\s+per\s+(customer|user)/i.test(text);
      const limits = [
        newOnly && 'new customers only',
        once && 'once',
        onlyValue && `₹${onlyValue} order only`,
      ].filter(Boolean);

      return {
        name: String(c.title || c.name || '').trim() || 'Payment offer',
        discountPct: action.valueType === 'PERCENTAGE' ? value : 0,
        flatOff: action.valueType === 'PERCENTAGE' ? null : value,
        code: String(c.couponCode ?? '').trim() || null,
        maxDiscount: Number.isFinite(cap) && cap > 0 ? cap : null,
        limits: limits.length ? limits.join(' · ') : null,
        restricted: newOnly || Boolean(onlyValue),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.discountPct - a.discountPct);
}

/**
 * The "How to use" tab. Woohoo stores it either as a JSON list of illustrated
 * steps (Ajio) or as plain HTML (RuPay).
 */
function howToUseFrom(product) {
  const raw = product.cpg?.howToUse;
  if (!raw) return null;
  let steps;
  try {
    const list = JSON.parse(raw);
    steps = Array.isArray(list) ? list.flatMap((s) => htmlToSteps(s?.description ?? '')) : [];
  } catch {
    steps = htmlToSteps(raw);
  }
  return steps.length ? steps : null;
}

export async function fetchBrand({ slug, url }) {
  const { body } = await fetchText(url);
  const product = productState(body);
  if (!product?.name) return null;

  /*
    Gift-only listings ("Personalize", no "For Myself") are flagged so a merge
    can leave them out when the brand has a normal card too. They can carry an
    `offerShortDesc` the page never shows — Ajio's ₹100 gift voucher says "25%
    Discount" in the data while its page offers none — and merged in, that
    became Ajio's headline figure and its page the buy link.
  */
  const giftOnly = Array.isArray(product.orderModes) && !product.orderModes.includes('self');

  const price = product.price ?? {};
  const campaigns = paymentOffersFrom(product);
  const headline = discountFrom(product);
  const bonusPct = headline.bonusPct;
  const bonus = bonusPct ? { bonusPct } : {};
  /*
    Woohoo sometimes puts a one-off promo in the card's own headline: RuPay's
    reads "99% Discount" because of a new-customer coupon worth 90% on a ₹10
    order. That isn't the card's price, so when the headline matches a
    restricted promo the card counts as face value and the promo is shown with
    its conditions instead.
  */
  const discountPct = campaigns.some(
    (c) => c.restricted && Math.abs(c.discountPct - headline.discountPct) <= 10,
  )
    ? 0
    : headline.discountPct;

  const listed = (price.denominations ?? [])
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const min = Number(price.min);
  const max = Number(price.max);

  // "SLAB" = fixed denominations. "RANGE" = buy any amount between min and max.
  const isRange = String(price.type).toUpperCase() === 'RANGE' || listed.length === 0;

  if (isRange && !(Number.isFinite(min) && Number.isFinite(max) && max > 0)) return null;
  if (!isRange && !listed.length) return null;

  const terms = htmlToText(product.importantInstructions);
  // Woohoo states validity in its own field ("Upto 2 Years from the date of
  // issue") rather than in the terms, so the terms alone said "Not stated".
  const expiry = String(product.expiry ?? '').trim();
  // The "Terms & Conditions" tab — the full list, beyond the short
  // "Important instructions" that were all we used to read.
  const fullTerms = htmlToBullets(product.tnc?.content ?? '');
  const description = htmlToText(product.shortDescription ?? product.description ?? '');

  const name = cleanBrandName(product.name);
  // A "Get Extra" card repeats its bonus as a campaign ("Get 8% extra on your
  // order value"). That's the same 8%, not a second saving on top — listed
  // again it read as "up to 8% off by payment method".
  const paymentOffers = campaigns.filter(
    (p) => !(bonusPct && /extra/i.test(p.name)),
  );

  return {
    key: brandKey(product.name),
    canonicalUrl: `${ORIGIN}/${product.url ?? slug}`,
    name,
    logo: product.images?.thumbnail ?? product.image ?? null,
    image: product.images?.thumbnail ?? null,
    website: null,
    description: description ? description.slice(0, 240) : null,
    offer: {
      platformId: PLATFORM.id,
      productUrl: url,
      slug,
      ...(giftOnly ? { giftOnly: true } : {}),
      headlineDiscountPct: discountPct,
      ...bonus,
      denominations: isRange ? [] : listed.map((value) => ({ value, discountPct, ...bonus })),
      // An open-value card: the buyer types any amount within these bounds.
      customAmount: isRange ? { min, max, discountPct, ...bonus, sourceUrl: url } : null,
      keyFacts: deriveKeyFacts([expiry ? `Validity: ${expiry}.` : '', terms, fullTerms.join('\n')]),
      howToUse: howToUseFrom(product),
      otherTerms: [...new Set([...htmlToBullets(product.importantInstructions), ...fullTerms])],
      paymentOffers,
      redemption: null,
      inStock: true,
      deliveryEta: 'Instant · email',
      maxQtyPerOrder: Number(product.quantity?.max) || null,
    },
  };
}
