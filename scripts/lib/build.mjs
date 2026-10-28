/**
 * Turns raw per-page scrape results into catalog brands.
 *
 * Shared by the full scrape (`scripts/scrape.mjs`) and the on-open discovery of
 * newly-listed cards (`server/discover.mjs`), so both classify, fold and merge
 * identically.
 */

// ------------------------------------------------------------ classification
/**
 * Order matters — the first match wins, so the most specific/branded signals go
 * first. Every alternative is \b-anchored: without word boundaries "blockbuster"
 * matched the Travel rule's "bus" and filed Zee5 under Travel.
 */
export const CATEGORY_RULES = [
  ['Entertainment', /\b(pvr|inox|cinepolis|cinema|movies?|bookmyshow|netflix|prime video|hotstar|jiocinema|sony ?liv|zee5?|voot|gaana|spotify|wynk|ott|xbox|playstation|steam|bgmi|gaming|hoichoi|discovery|subscription|binge|streaming)\b/i],
  ['Travel', /\b(air ?india|indigo|vistara|spicejet|akasa|airline|flights?|travel|hotels?|yatra|makemytrip|goibibo|uber|ola|ixigo|oyo|cleartrip|irctc|railway|bus tickets?|redbus|taxi|cabs?)\b/i],
  // Grocery before Food & Beverage: BigBasket's own blurb says "food", which
  // filed a supermarket under restaurants.
  ['Grocery', /\b(grocery|groceries|bigbasket|big ?basket|blinkit|zepto|instamart|dmart|supermarket|spencer|kirana|daily needs|milkbasket|natures basket)\b/i],
  ['Food & Beverage', /\b(pizza|dominos?|kfc|mcdonald|burger|swiggy|zomato|coffee|cafe|starbucks|barbeque|barbecue|biryani|restaurants?|subway|dunkin|baskin|haldiram|chai|food|dining|bakery|bakingo|faasos|behrouz|wow ?momo|tim hortons|beer|pub)\b/i],
  ['Health & Beauty', /\b(nykaa|health ?kart|healthcare|pharmacy|pharma|apollo|wellness|beauty|cosmetics?|purplle|mamaearth|plum|forest essentials|1mg|pharmeasy|supplements?|nutrition|gym|fitness|cult|salon|spa|lenskart|titan eye)\b/i],
  ['Electronics', /\b(croma|reliance digital|vijay sales|electronics?|appliances?|laptops?|mobiles?|apple|samsung|oneplus|boat|noise|jbl|headphones?|gadgets?|earphones?|earbuds?|smart ?watch(es)?|speakers?|soundbars?|wearables?|power ?banks?|chargers?|televisions?|refrigerators?|washing machines?)\b/i],
  ['Fashion', /\b(myntra|ajio|fashion|apparel|clothing|clothes|shoes?|footwear|jewell?ery|tanishq|titan|lifestyle|pantaloons?|westside|zara|puma|adidas|nike|levi|allen solly|van heusen|peter england|bata|decathlon|birkenstock|eyewear|watches|bags?|luxe|activewear|athleisure|leggings|joggers|swimwear|innerwear|lingerie|sports ?bras?|t-?shirts?|denim|kurtas?|sarees?|ethnic ?wear|outfits?|wardrobe)\b/i],
  ['e-Commerce', /\b(amazon|flipkart|meesho|snapdeal|tata cliq|shopping|marketplace|online store)\b/i],
];

/**
 * The brand name decides the category; the description is only a fallback.
 *
 * Matching both together let marketing copy win: AJIO's blurb says "straight to
 * your screen", Amazon Pay's mentions "mobile recharge", and a fuel voucher and
 * a silver coin both mentioned electronics — all three landed under Electronics.
 */
/**
 * How many *distinct* terms of a rule the text uses.
 *
 * A single word decides nothing in a description — Blissclub sells activewear
 * but its blurb mentions "travel and dance breaks", and that lone word filed it
 * under Travel. Counting distinct hits lets the real subject win.
 */
const strength = (re, text) => {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return new Set((text.match(global) ?? []).map((m) => m.toLowerCase())).size;
};

export const categorise = (name, description = '') => {
  // The brand name is decisive when it matches — it can't be incidental.
  const byName = CATEGORY_RULES.find(([, re]) => re.test(name))?.[0];
  if (byName) return byName;

  /*
    Otherwise fall back to the description — but rank the categories instead of
    taking the first that matches at all. Marketing copy name-drops other
    categories constantly ("perfect for travel", "straight to your screen"), and
    first-match let one stray word win: Blissclub sells activewear and was filed
    under Travel. The best-supported category wins instead, so four apparel
    terms beat one passing "travel". Ties go to the earlier (more specific)
    rule, and a single clear signal still counts — plenty of brands have a
    one-line blurb naming their category exactly once.
  */
  let best = null;
  for (const [category, re] of CATEGORY_RULES) {
    const score = strength(re, description);
    if (score > (best?.score ?? 0)) best = { category, score };
  }
  return best ? best.category : 'Other';
};

/** Deterministic, evenly-spread brand gradient — same brand, same colours. */
export function gradientFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return [`hsl(${hue} 78% 55%)`, `hsl(${(hue + 42) % 360} 82% 62%)`];
}

export const initialsFor = (name) => {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const s = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '??').slice(0, 2);
  return s.toUpperCase();
};

export const keywordsFor = (name, description, category) =>
  [
    ...new Set(
      `${name} ${category} ${description ?? ''}`
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && w.length < 18),
    ),
  ].slice(0, 18);

// ------------------------------------------------------------------- merging
/**
 * Merge two listings of the same brand on the same seller.
 *
 * Sellers (Amazon especially) list one brand under several ASINs that differ
 * only in artwork or validity but carry *different denomination sets* — keeping
 * just one dropped real options, so the denominations are unioned and the
 * richer listing supplies the terms.
 */
export function preferOffer(a, b) {
  // A gift-only listing never outranks the brand's normal card, or lends it
  // slabs: its figures aren't what a shopper buying for themselves gets.
  if (Boolean(a.giftOnly) !== Boolean(b.giftOnly)) return a.giftOnly ? b : a;

  const facts = (o) => Object.values(o.keyFacts).filter((f) => f.status !== 'unknown').length;

  const primary =
    a.headlineDiscountPct !== b.headlineDiscountPct
      ? a.headlineDiscountPct > b.headlineDiscountPct
        ? a
        : b
      : facts(a) !== facts(b)
        ? facts(a) > facts(b)
          ? a
          : b
        : a.denominations.length >= b.denominations.length
          ? a
          : b;

  /*
    Each denomination remembers the listing that actually sells it.

    One seller often has several listings for a brand with *different* slabs —
    Woohoo lists PhonePe twice, a 15% card covering ₹5–₹2,500 and a 0% "special"
    covering ₹10–₹10,000. Without this the buy button fell back to the first
    source for every slab, so picking ₹2,000 sent the buyer to a listing that
    doesn't sell ₹2,000.
  */
  const stamp = (offer) =>
    offer.denominations.map((d) => ({ ...d, sourceUrl: d.sourceUrl ?? offer.productUrl ?? null }));

  const byValue = new Map();
  for (const d of [...stamp(a), ...stamp(b)]) {
    // Keyed by value *and* label: several Zee5 language packs share ₹699 but
    // are different products, so they must not collapse into one another.
    const k = `${d.value}|${d.label ?? ''}`;
    const existing = byValue.get(k);
    // Same face value on two listings — the buyer would take the cheaper one.
    if (!existing || d.discountPct > existing.discountPct) byValue.set(k, d);
  }

  // Union of source pages, so a live re-check revisits every one of them.
  const sources = new Map();
  for (const s of [...(a.sources ?? []), ...(b.sources ?? [])]) {
    if (!sources.has(s.url) || (!sources.get(s.url).label && s.label)) sources.set(s.url, s);
  }

  return {
    ...primary,
    denominations: [...byValue.values()].sort(
      (x, y) => x.value - y.value || String(x.label ?? '').localeCompare(String(y.label ?? '')),
    ),
    customAmount: primary.customAmount ?? a.customAmount ?? b.customAmount,
    sources: [...sources.values()],
    listingCount: sources.size,
  };
}

/** A single key token that marks where the brand name ends and the plan begins. */
const PLAN_TOKEN =
  /^(\d+|\d+m|\d+y|months?|years?|annual|yearly|quarterly?|monthly|hd|4k|uhd|sd|premium|lite|plus|basic|super|pack|plan|combo|subscription|tamil|telugu|malayalam|kannada|bangla|bengali|marathi|odia|punjabi|gujarati|hindi|fifa|wc\d*|rs)$/i;

/**
 * Where a brand key stops being a brand and starts being a plan.
 * "epic-on-1-month-subscription-rs-59" -> "epic-on"
 * "zee5-tamil-12m"                     -> "zee5"
 * "amazon-fresh" / "ajio-luxe"         -> null (genuinely separate brands)
 */
export function stemOf(key) {
  const parts = key.split('-');
  for (let i = 1; i < parts.length; i++) {
    if (PLAN_TOKEN.test(parts[i])) return parts.slice(0, i).join('-');
  }
  return null;
}

/** "1-month-subscription-rs-59" -> "1 Month Subscription" */
function labelFromSuffix(suffix) {
  return suffix
    .replace(/-/g, ' ')
    .replace(/\brs\.?\s*\d+\b/gi, '')
    .replace(/\s+\d+$/, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sellers list each subscription plan as its own product ("Zee5 12M 4K",
 * "Zee5 Tamil 12M"). Fold those into the parent brand so one page shows every
 * pack, which is how GyFTR models the same brand.
 */
export function foldVariantsIntoParents(byKey) {
  // Group every key by the brand stem it belongs to.
  const groups = new Map();
  for (const key of byKey.keys()) {
    const stem = stemOf(key);
    if (!stem || stem === key) continue;
    if (!groups.has(stem)) groups.set(stem, []);
    groups.get(stem).push(key);
  }

  // Longest stems first, so "zee5-fifa-wc26" resolves before "zee5" if both exist.
  for (const [stem, childKeys] of [...groups.entries()].sort((a, b) => b[0].length - a[0].length)) {
    const children = childKeys.map((k) => byKey.get(k)).filter(Boolean);
    if (!children.length) continue;

    let parent = byKey.get(stem);

    // Some sellers list *only* the plans and never a plain brand card (Woohoo
    // does this for Epic On). A lone orphan stays as-is; two or more siblings
    // earn a synthesised parent so they share one comparison page.
    if (!parent) {
      if (children.length < 2) continue;
      const shortest = children.reduce((a, b) => (a.name.length <= b.name.length ? a : b));
      parent = {
        id: stem,
        name: shortest.name,
        logo: shortest.logo,
        image: shortest.image,
        website: shortest.website,
        description: shortest.description,
        offers: [],
      };
      byKey.set(stem, parent);
    }

    for (const child of children) {
      const childKey = childKeys[children.indexOf(child)];
      if (childKey === stem) continue;

      const suffix = childKey.slice(stem.length + 1);
      // Prefer the difference between the two display names; fall back to the
      // key suffix when every plan carries the same name (Epic On does).
      const fromName = child.name
        .replace(new RegExp(`^${parent.name}\\s*`, 'i'), '')
        .replace(/\s+[A-Za-z]$/, '')
        .trim();
      const label = fromName || labelFromSuffix(suffix);

      for (const offer of child.offers) {
        parent.offers.push({
          ...offer,
          denominations: offer.denominations.map((d) => ({ ...d, label: d.label ?? label })),
          // Tag this plan's page with its label so a re-check can re-apply it.
          sources: (offer.sources ?? [{ url: offer.productUrl, label: null }]).map((sourceRef) => ({
            ...sourceRef,
            label: sourceRef.label ?? label,
          })),
        });
      }
      parent.logo ??= child.logo;
      parent.description ??= child.description;
      byKey.delete(childKey);
    }
  }

  // Folding can leave one seller contributing several offers; collapse them.
  for (const brand of byKey.values()) {
    const perPlatform = new Map();
    for (const offer of brand.offers) {
      const existing = perPlatform.get(offer.platformId);
      perPlatform.set(offer.platformId, existing ? preferOffer(existing, offer) : offer);
    }
    brand.offers = [...perPlatform.values()];
  }
}

/** Raw scrape entries -> finished catalog brands. */
export function merge(collected) {
  const byKey = new Map();
  const seenProducts = new Set();

  for (const entry of collected) {
    // Remember where this offer came from. Folded/merged offers draw on several
    // product pages, and a live re-check has to revisit all of them — otherwise
    // it refetches one page and wipes out the rest (Zee5's ten packs collapsed
    // to whichever single variant happened to win the merge).
    entry.offer.sources ??= [{ url: entry.offer.productUrl, label: null }];

    // Same canonical product reached via several browse paths — take it once.
    const canonical = `${entry.offer.platformId}:${entry.canonicalUrl ?? entry.offer.productUrl}`;
    if (seenProducts.has(canonical)) continue;
    seenProducts.add(canonical);

    const existing = byKey.get(entry.key);
    if (existing) {
      // One seller can list several variants of the same brand; keep the best.
      const dupeIndex = existing.offers.findIndex((o) => o.platformId === entry.offer.platformId);
      if (dupeIndex > -1) {
        existing.offers[dupeIndex] = preferOffer(existing.offers[dupeIndex], entry.offer);
        existing.logo ??= entry.logo;
        existing.description ??= entry.description;
        continue;
      }
      // Keep the richest metadata, but never overwrite a real value with null.
      existing.logo ??= entry.logo;
      existing.image ??= entry.image;
      existing.website ??= entry.website;
      existing.description ??= entry.description;
      if (entry.name.length < existing.name.length) existing.name = entry.name;
      existing.offers.push(entry.offer);
    } else {
      byKey.set(entry.key, {
        id: entry.key,
        name: entry.name,
        logo: entry.logo,
        image: entry.image,
        website: entry.website,
        description: entry.description,
        offers: [entry.offer],
      });
    }
  }

  foldVariantsIntoParents(byKey);

  const now = new Date().toISOString();

  return [...byKey.values()]
    .map((b) => {
      const category = categorise(b.name, b.description ?? '');
      return {
        ...b,
        category,
        tagline: b.description || `${b.name} gift cards, compared across sellers.`,
        initials: initialsFor(b.name),
        gradient: gradientFor(b.id),
        keywords: keywordsFor(b.name, b.description, category),
        offers: b.offers
          .map((o) => ({ ...o, lastChecked: now, verified: true }))
          .sort((x, y) => y.headlineDiscountPct - x.headlineDiscountPct),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
