import { fetchText, extractSitemapUrls } from '../lib/http.mjs';
import { htmlToBullets, htmlToText, cleanBrandName, brandKey } from '../lib/html.mjs';
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

function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
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

  const instructions = htmlToBullets(detail.important_instruction);
  const checkout = htmlToBullets(detail.checkout_instruction);
  const faqText = htmlToText(detail.faqs);

  const keyFacts = deriveKeyFacts([
    instructions.join('\n'),
    checkout.join('\n'),
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
      otherTerms: instructions.concat(checkout),
      paymentOffers: paymentOffers.length > 1 ? paymentOffers : [],
      redemption: detail.redemption_type === 'ON' ? 'Online' : detail.redemption_type || null,
      inStock: true,
      deliveryEta: 'Instant · SMS / email / WhatsApp',
    },
  };
}
