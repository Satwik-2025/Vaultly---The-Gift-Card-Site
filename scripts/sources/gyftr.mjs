import { fetchText, extractSitemapUrls } from '../lib/http.mjs';
import { htmlToBullets, htmlToSteps, htmlToText, cleanBrandName, brandKey } from '../lib/html.mjs';
import { deriveKeyFacts } from '../lib/facts.mjs';
import { findViaSitemap } from '../lib/find.mjs';

export const PLATFORM = {
  id: 'gyftr',
  name: 'GyFTR',
  tagline: 'Bank-linked voucher marketplace · 300+ brands',
  accent: '#f0568c',
  initials: 'GY',
  logo: 'logos/gyftr.png',
  homeUrl: 'https://www.gyftr.com/',
};

const ORIGIN = 'https://www.gyftr.com';

/** Non-brand pages that also live at the URL root. */
const NOT_BRANDS = new Set([
  'cart', 'discount', 'offers', 'my-profile', 'order-history', 'wallet-transaction',
  'corporategifting', 'all-brands', 'brands', 'login', 'blog', 'about-us', 'contact-us',
  'faq', 'terms-conditions', 'privacy-policy', 'sitemap', 'check-balance', 'gyftr-coins',
]);

export async function listBrandUrls() {
  const { body } = await fetchText(`${ORIGIN}/sitemap.xml`);
  return extractSitemapUrls(body)
    .filter((u) => u.startsWith(ORIGIN))
    .map((u) => u.replace(`${ORIGIN}/`, '').replace(/\/$/, ''))
    .filter((slug) => slug && !slug.includes('/') && !NOT_BRANDS.has(slug))
    .map((slug) => ({ slug, url: `${ORIGIN}/${slug}` }));
}

/** Does GyFTR stock this brand right now? Matched against their sitemap. */
export async function findBrand({ brandId, name }) {
  return findViaSitemap(PLATFORM.id, listBrandUrls, { brandId, name });
}

/**
 * GyFTR has no "how to use" field, but its FAQs often answer "How do I redeem
 * my … gift card?" step by step. That answer, when there is one.
 */
function howToUseFrom(faqsHtml) {
  const lines = htmlToText(faqsHtml)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const isQuestion = (l) => /\?$/.test(l);
  const start = lines.findIndex(
    (l) =>
      isQuestion(l) &&
      /\bhow\b[^?]{0,40}\b(use|redeem|apply|add)\b/i.test(l) &&
      // "How to send … to someone else?" is about gifting, not using.
      !/\bsend\b|\bgift(ing)? to\b/i.test(l),
  );
  if (start === -1) return null;
  const answer = [];
  for (const l of lines.slice(start + 1)) {
    // The next question, or the marketing that follows the steps
    // ("Ajio Gift Cards for Corporate Gifting", "Download the GyFTR App…").
    if (isQuestion(l) || /\bgift cards? for\b|\bdownload the gyftr app\b/i.test(l)) break;
    answer.push(l);
  }
  const steps = htmlToSteps(answer.join('\n'));
  return steps.length ? steps : null;
}

function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * What GyFTR's "Instructions", "How to redeem" and "T&C" tabs actually show.
 *
 * The page's embedded data carries an older copy of the instructions, and it
 * can say the opposite of the live one: for Air India it read "can be combined
 * with any offer" and "Multiple GV/GC can be used", while the tab says vouchers
 * CANNOT be clubbed with offers and caps them at 3 (2 alongside another
 * payment method). The tabs load from this endpoint, so read it directly.
 * Null when it doesn't answer — the embedded copy is still better than nothing.
 */
async function liveDetails(cmBrandId) {
  if (!cmBrandId) return null;
  try {
    const res = await fetch(`${ORIGIN}/commonutility/api/v1/shop/getBrandDetail`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ brand: Number(cmBrandId) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json())?.data;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** `{"1": {"text": "Select your preferred location."}, "2": …}` → steps. */
function redeemSteps(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const steps = Object.keys(parsed ?? {})
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((k) => htmlToSteps(parsed[k]?.text ?? ''));
    return steps.length ? steps : null;
  } catch {
    return null;
  }
}

export async function fetchBrand({ slug, url }) {
  const { body } = await fetchText(url);
  const next = parseNextData(body);
  const brandInfo = next?.props?.pageProps?.reduxState?.brandInfo;
  const detail = brandInfo?.brandDetailStore;

  if (!detail?.brand_name) return null;
  const live = await liveDetails(detail.cm_brand_id);

  // `mrp` is the denomination's face value. For subscription brands (Zee5,
  // SonyLIV…) each product is a named pack rather than a plain amount, so keep
  // `product_name` as a label when it says more than the brand name does.
  const byValue = new Map();
  for (const p of brandInfo.productDetailStore ?? []) {
    const value = Number(p.mrp);
    if (!Number.isFinite(value) || value <= 0) continue;

    const raw = String(p.product_name ?? '').trim();
    // Most products are named after the brand ("Lenskart INR") and carry no
    // information. Only keep a label when it says something the brand name
    // doesn't — e.g. Zee5's "Premium HD Annual Pack 1299".
    const squash = (s) =>
      s
        .toLowerCase()
        // Drop the amount as well as currency/voucher filler: product names are
        // routinely "Lenskart INR 1000", which is just the brand plus the value.
        .replace(/\b\d+\b/g, '')
        .replace(/\b(inr|rs|rupees|gv|gc|egv|e-?gift|gift|voucher|card)\b/g, '')
        .replace(/[^a-z]/g, '');

    const isPackName = raw && squash(raw) !== '' && squash(raw) !== squash(String(detail.brand_name));
    // "Premium HD Annual Pack 1299" -> "Premium HD Annual Pack"
    const label = isPackName ? raw.replace(/\s*\b\d{2,6}\b\s*$/, '').trim() || null : null;

    const existing = byValue.get(value);
    if (!existing || (!existing.label && label)) byValue.set(value, { value, label });
  }

  const denominations = [...byValue.values()].sort((a, b) => a.value - b.value);
  if (!denominations.length) return null;

  const discountPct = Number(detail.defaut_pg_dis ?? detail.maxDisValue ?? 0);

  const instructions = htmlToBullets(live?.product_brand_instruct || detail.important_instruction);
  const checkout = htmlToBullets(detail.checkout_instruction);
  // The full numbered T&C ("1. This is an Air India Gift Voucher… <br/>2. …").
  const fullTerms = htmlToBullets(
    String(live?.product_brand_term_cond ?? '').replace(/<br\s*\/?>\s*\d{1,2}\.\s*/gi, '\n'),
  ).map((t) => t.replace(/^\d{1,2}\.\s*/, ''));
  const faqText = htmlToText(detail.faqs);

  // The instructions come first: they're GyFTR's own summary, and where the
  // fine print disagrees with them (Air India's T&C still says "can be
  // combined with any offer") the summary is what the shop enforces.
  // Full texts rather than the bullet lists, which skip short lines.
  const keyFacts = deriveKeyFacts([
    htmlToText(live?.product_brand_instruct || detail.important_instruction),
    htmlToText(detail.checkout_instruction),
    htmlToText(String(live?.product_brand_term_cond ?? '').replace(/<br\s*\/?>/gi, '\n')),
    faqText,
    htmlToText(detail.long_description),
  ]);

  // Discounts also vary by payment method — worth surfacing, it's why the
  // headline number and a bank-specific number can differ.
  const paymentOffers = (brandInfo.brandPgListStore ?? [])
    .map((pg) => ({ name: pg.pg_name, discountPct: Number(pg.pg_discount) }))
    .filter((p) => p.name && Number.isFinite(p.discountPct));

  const name = cleanBrandName(detail.brand_name);

  return {
    key: brandKey(detail.brand_name),
    name,
    logo: detail.brand_logo || null,
    image: detail.brand_image || null,
    website: detail.website || null,
    description: htmlToText(detail.short_description).slice(0, 240) || null,
    offer: {
      platformId: PLATFORM.id,
      productUrl: url,
      slug,
      headlineDiscountPct: discountPct,
      denominations: denominations.map((d) => ({ ...d, discountPct })),
      customAmount: null,
      keyFacts,
      otherTerms: [...new Set([...instructions, ...checkout, ...fullTerms])],
      paymentOffers: paymentOffers.length > 1 ? paymentOffers : [],
      howToUse:
        redeemSteps(live?.product_brand_redeem_step) ??
        howToUseFrom(detail.long_description) ??
        howToUseFrom(detail.faqs),
      redemption: detail.redemption_type === 'ON' ? 'Online' : detail.redemption_type || null,
      inStock: true,
      deliveryEta: 'Instant · SMS / email / WhatsApp',
    },
  };
}
