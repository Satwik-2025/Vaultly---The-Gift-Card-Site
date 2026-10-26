import { brandKey, cleanBrandName, decodeEntities, htmlToBullets } from '../lib/html.mjs';
import { deriveKeyFacts } from '../lib/facts.mjs';
import { matchesBrand } from '../lib/find.mjs';

/**
 * Amazon.in adapter.
 *
 * Amazon returns a bot check to plain HTTP clients, so this one drives a real
 * Chromium via Playwright. That makes it slower and less reliable than the
 * other sources — Amazon can still serve a CAPTCHA — so every entry point here
 * degrades to "return nothing" rather than throwing the whole scrape away.
 */

export const PLATFORM = {
  id: 'amazon',
  name: 'Amazon',
  tagline: 'Brand e-gift cards delivered to your Amazon account',
  accent: '#ff9c26',
  initials: 'AZ',
  logo: 'logos/amazon.png',
  homeUrl: 'https://www.amazon.in/gift-card-store/b?node=3704982031',
};

let browserPromise = null;

async function getContext() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');

      // Prefer a real installed browser: it carries a complete fingerprint
      // (which matters against Amazon's bot detection) and avoids Playwright's
      // bundled build, which needs a VC++ runtime this machine doesn't have.
      const launchOpts = {
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      };
      let browser = null;
      let lastErr = null;
      for (const channel of ['chrome', 'msedge', undefined]) {
        try {
          browser = await chromium.launch({ ...launchOpts, ...(channel ? { channel } : {}) });
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!browser) throw lastErr;
      const context = await browser.newContext({
        // Deliberately NOT overriding the user agent: a spoofed UA that
        // disagrees with the real browser build makes Amazon serve a bogus
        // file download instead of the page.
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        viewport: { width: 1366, height: 900 },
        acceptDownloads: false,
        extraHTTPHeaders: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-IN,en-GB;q=0.9,en;q=0.8',
          'upgrade-insecure-requests': '1',
        },
      });
      // The one automation tell that Amazon's fingerprinting reliably checks.
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // Amazon rejects a cold jump straight to a search URL; landing on the
      // homepage first picks up the session cookies it expects.
      const warmup = await context.newPage();
      await warmup
        .goto('https://www.amazon.in/', { waitUntil: 'domcontentloaded', timeout: 45000 })
        .catch(() => {});
      await warmup.close().catch(() => {});

      return { browser, context };
    })();
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const { browser } = await browserPromise;
  await browser.close().catch(() => {});
  browserPromise = null;
}

const isCaptcha = (html) =>
  /Enter the characters you see below|api-services-support@amazon\.com|To discuss automated access/i.test(
    html,
  );

/**
 * Amazon's softer throttle: a near-empty page offering a "Continue shopping"
 * button instead of the product.
 *
 * It was going undetected, because it says none of the things `isCaptcha`
 * looks for. The fetch then found no product title and returned null, which
 * the caller read as "this listing is unreadable" — which is why every
 * re-check reported "couldn't reach Amazon" with no explanation.
 *
 * We don't click the button: it exists to interrupt automated traffic, and
 * driving through it would be bypassing that. We report it instead.
 */
const isThrottled = (html) =>
  html.length < 20000 && /Click the button below to continue shopping/i.test(html);

/** Thrown when Amazon is blocking us rather than the listing being bad. */
class AmazonBlocked extends Error {
  constructor(kind) {
    super(`amazon: ${kind}`);
    this.blocked = true;
    this.kind = kind;
  }
}

/** Distinguishes "Amazon won't talk to us" from "no such product". */
const blockedBy = (html) => (isCaptcha(html) ? 'captcha' : isThrottled(html) ? 'throttled' : null);


async function withPage(fn) {
  const { context } = await getContext();
  const page = await context.newPage();
  // Images and fonts are pure cost here.
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2}', (r) => r.abort());
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Amazon puts the discount in the listing title: "Flat 8% | E-Gift Card". */
function discountFromTitle(title) {
  const m =
    title.match(/(?:flat|extra|upto|up\s*to)\s*(\d{1,2}(?:\.\d)?)\s*%/i) ??
    title.match(/(\d{1,2}(?:\.\d)?)\s*%\s*(?:off|discount)/i);
  return m ? Number(m[1]) : 0;
}

/** "HealthKart | Flat 8% Off | E-Gift Card | …" -> "HealthKart" */
function brandFromTitle(title) {
  const head = decodeEntities(title).split('|')[0].trim();
  return cleanBrandName(head || title);
}

/** Several queries, because one search page only surfaces a slice of the store. */
const SEARCH_TERMS = [
  'e-gift card',
  'gift card instant delivery',
  'e-gift voucher',
  'gift card flat off',
];

export async function listBrandUrls({ pages = 4 } = {}) {
  return withPage(async (page) => {
    const found = new Map();

    const targets = SEARCH_TERMS.flatMap((term) =>
      Array.from({ length: pages }, (_, i) => ({ term, page: i + 1 })),
    );

    for (const { term, page: p } of targets) {
      const url = `https://www.amazon.in/s?k=${encodeURIComponent(term)}&i=gift-cards&page=${p}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const block = blockedBy(await page.content());
        if (block) {
          console.error(`[amazon] ${block} while listing — stopping early`);
          break;
        }
        await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 });
      } catch {
        continue;
      }

      const items = await page.$$eval('[data-component-type="s-search-result"]', (nodes) =>
        nodes
          .map((n) => {
            const a = n.querySelector('a.a-link-normal[href*="/dp/"]');
            const title = n.querySelector('h2')?.textContent?.trim() ?? '';
            const href = a?.getAttribute('href') ?? '';
            return { title, href };
          })
          .filter((x) => x.title && x.href),
      );

      if (!items.length) continue;

      for (const { title, href } of items) {
        const asin = href.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
        if (!asin || found.has(asin)) continue;
        found.set(asin, {
          slug: asin,
          url: `https://www.amazon.in/dp/${asin}`,
          title,
        });
      }
    }

    return [...found.values()];
  });
}

/**
 * Find one specific brand on Amazon.
 *
 * `listBrandUrls` sweeps four generic queries for breadth, which only ever
 * surfaces a slice of the store — The Body Shop is listed but never appeared in
 * that sweep, so the catalog showed GyFTR and Woohoo and silently implied
 * Amazon had no card. Searching for the brand by name finds it directly.
 *
 * Throws on a bot wall rather than returning []: the caller uses "no results"
 * as grounds to delist a seller, and a CAPTCHA must never be mistaken for that.
 */
export async function findBrand({ brandId, name }) {
  return withPage(async (page) => {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(`${name} gift card`)}&i=gift-cards`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const block = blockedBy(await page.content());
    if (block) throw new AmazonBlocked(block);

    try {
      await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 });
    } catch {
      return []; // Genuinely no results for this brand.
    }

    const items = await page.$$eval('[data-component-type="s-search-result"]', (nodes) =>
      nodes
        .map((n) => ({
          title: n.querySelector('h2')?.textContent?.trim() ?? '',
          href: n.querySelector('a.a-link-normal[href*="/dp/"]')?.getAttribute('href') ?? '',
        }))
        .filter((x) => x.title && x.href),
    );

    // A search for one brand also returns its shelf-mates, so keep only the
    // listings whose own title names this brand.
    const found = new Map();
    for (const { title, href } of items) {
      const asin = href.match(/\/dp\/([A-Z0-9]{10})/)?.[1];
      if (!asin || found.has(asin)) continue;
      if (!matchesBrand(brandFromTitle(title), brandId, name)) continue;
      found.set(asin, { slug: asin, url: `https://www.amazon.in/dp/${asin}`, title });
    }
    return [...found.values()];
  });
}

export async function fetchBrand({ slug, url, title: listTitle }) {
  return withPage(async (page) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      return null;
    }

    const html = await page.content();
    const block = blockedBy(html);
    // Throw, don't return null: the caller must be able to tell a blocked
    // request from a delisted product, or it reports the wrong thing (and
    // could even delete a listing that is perfectly alive).
    if (block) throw new AmazonBlocked(block);

    const title =
      (await page.$eval('#productTitle', (n) => n.textContent?.trim()).catch(() => null)) ??
      listTitle ??
      null;
    if (!title) return null;

    const name = brandFromTitle(title);
    // Amazon Pay's own balance top-up isn't a brand gift card — it's the
    // wallet itself, and it has no discount to compare.
    if (!name || /^amazon\s*pay\b/i.test(name) || /^amazon\b.*\bgift\s*card/i.test(title)) {
      return null;
    }

    const discountPct = discountFromTitle(title);

    // Denominations are the ₹-prefixed twister buttons. Matching on the ₹ sign
    // matters: a bare-number selector also picks up the *design* twister, which
    // is why this used to report 1000/3000/10000 for a card that sells seven
    // denominations.
    const values = await page
      .$$eval('#variation_denomination .a-button-text, .a-button-text, option', (nodes) =>
        nodes
          .map((n) => (n.textContent ?? '').trim())
          .filter((t) => /₹|Rs\.?\s?\d/.test(t))
          .map((t) => t.match(/(?:₹|Rs\.?\s?)\s?([\d,]+)/)?.[1] ?? '')
          .filter(Boolean),
      )
      .catch(() => []);

    let denominations = [
      ...new Set(
        values
          .map((v) => Number(String(v).replace(/,/g, '')))
          .filter((v) => Number.isFinite(v) && v >= 50 && v <= 100000),
      ),
    ].sort((a, b) => a - b);

    let denominationsAreRange = false;
    if (!denominations.length) {
      const range = (title.match(/₹\s?(\d[\d,]*)\s*(?:-|to)\s*₹?\s?(\d[\d,]*)/) ?? []).slice(1);
      if (range.length === 2) {
        denominationsAreRange = true;
        denominations = range.map((v) => Number(v.replace(/,/g, '')));
      }
    }
    if (!denominations.length) return null;

    // Scoped to the informational blocks. `.a-expander-content` is deliberately
    // excluded — it also holds reviews and shipping blurb, which parsed into
    // "terms" like "4.5 out of 5 stars".
    const terms = await page
      .$$eval('#important-information, #productDescription, #feature-bullets', (nodes) =>
        nodes.map((n) => n.innerText ?? n.textContent ?? '').join('\n'),
      )
      .catch(() => '');

    const bullets = htmlToBullets(terms);

    const image = await page
      .$eval('#landingImage, #imgTagWrapperId img', (n) => n.getAttribute('src'))
      .catch(() => null);

    return {
      key: brandKey(name),
      canonicalUrl: url,
      name,
      logo: image,
      image,
      website: null,
      description: null,
      offer: {
        platformId: PLATFORM.id,
        productUrl: url,
        slug,
        headlineDiscountPct: discountPct,
        denominations: denominations.map((value) => ({ value, discountPct })),
        customAmount: denominationsAreRange
          ? { min: denominations[0], max: denominations[denominations.length - 1], discountPct }
          : null,
        keyFacts: deriveKeyFacts(terms ? [terms] : []),
        otherTerms: bullets,
        paymentOffers: [],
        redemption: null,
        inStock: true,
        deliveryEta: 'Instant · email',
      },
    };
  });
}
