/**
 * Domain model. This mirrors the shape written by `scripts/scrape.mjs` into
 * `public/catalog.json` — the app has no hand-authored catalog data.
 */

export type PlatformId = string;

export interface Platform {
  id: PlatformId;
  name: string;
  tagline: string;
  /** Accent colour for the panel glow, chips and buttons */
  accent: string;
  /** Two-letter mark, used only when the logo is missing or fails to load */
  initials: string;
  /** The seller's own logo, downloaded by `npm run logos` into /public/logos */
  logo?: string | null;
  homeUrl: string;
}

export type Category = string;

/**
 * How favourable a single key fact is. Drives the chip colour so four panels
 * can be compared without reading a word.
 */
export type FactStatus = 'good' | 'limited' | 'bad' | 'unknown';

export interface Fact {
  status: FactStatus;
  /** Short and scannable — this is what lines up across panels */
  headline: string;
  detail: string;
  /**
   * The seller's own sentence this was derived from. Null when the seller
   * doesn't state it, in which case `status` is 'unknown' — we never guess.
   */
  source: string | null;
}

/**
 * The four questions that decide whether a gift card is worth buying.
 * Always rendered in this order so the panels align.
 */
export interface KeyFacts {
  /** 1. Can multiple cards be used in a single transaction, and how many? */
  stacking: Fact;
  /** 2. Can it be clubbed with existing offers? */
  clubbing: Fact;
  /** 3. Validity */
  validity: Fact;
  /** 4. If partly used, does the remaining balance survive? */
  partialUse: Fact;
}

export interface Denomination {
  value: number;
  discountPct: number;
  /**
   * Set when the seller sells named packs rather than plain amounts —
   * e.g. Zee5's "Premium HD Annual Pack".
   */
  label?: string | null;
}

/** An open-value card: the buyer types any amount within these bounds. */
export interface CustomAmount {
  min: number;
  max: number;
  discountPct: number;
}

export interface PaymentOffer {
  name: string;
  discountPct: number;
  /** Flat rupees off, when the offer isn't a percentage. */
  flatOff?: number | null;
  /** Coupon the buyer has to enter, where the seller publishes one. */
  code?: string | null;
  /** Cap on the discount, in rupees. */
  maxDiscount?: number | null;
}

export interface Offer {
  platformId: PlatformId;
  productUrl: string;
  slug: string;
  headlineDiscountPct: number;
  /** Fixed slabs. Empty when the card is open-value — see `customAmount`. */
  denominations: Denomination[];
  /** Non-null when the buyer may enter any amount between min and max. */
  customAmount: CustomAmount | null;
  /** How many separate listings on this seller were merged into this offer. */
  listingCount?: number;
  /**
   * Every product page this offer was built from, with the plan label that page
   * contributed. A live re-check revisits all of them and re-merges.
   */
  sources?: { url: string; label: string | null }[];
  /** Seller's per-order quantity cap, where published. */
  maxQtyPerOrder?: number | null;
  keyFacts: KeyFacts;
  otherTerms: string[];
  /** Discount varies by payment method on some sellers */
  paymentOffers: PaymentOffer[];
  redemption: string | null;
  inStock: boolean;
  deliveryEta: string;
  /** ISO timestamp of the scrape that produced this */
  lastChecked: string;
  verified: boolean;
}

/**
 * CashKaro is a cashback site, not a gift card seller, so it never sits in
 * `offers` next to GyFTR/Woohoo/Amazon — a cashback rate and a gift card
 * discount are different things, bought in different places. It hangs off the
 * brand on its own.
 */
export interface CashKaro {
  name: string;
  /** The brand's own CashKaro store page. */
  storeUrl: string;
  /** False when CashKaro lists the brand but pays no cashback on it. */
  active: boolean;
  rate: {
    type: 'percent' | 'flat';
    amount: number;
    /** The rate usually applies to part of the catalogue only — never show it bare. */
    details: string | null;
    /** Previous rate, when the current one is a boost. */
    wasAmount: number | null;
  } | null;
  /**
   * Every published rate, headline first. CashKaro shows one rate up top and
   * hides the rest behind "View Cashback Rates" — Air India's ₹275 headline is
   * international flights only, with a separate ₹80 on domestic.
   */
  rates: { type: 'percent' | 'flat'; amount: number; details: string | null }[];
  /** Which surfaces earn cashback. */
  platforms: 'both' | 'website' | 'app' | 'unknown';
  /** CashKaro's own sentence about app vs website, quoted rather than paraphrased. */
  platformNote: string | null;
  /**
   * Their terms excluding gift-voucher payments from cashback, where stated.
   * On a gift card site this is the line that decides whether the two stack.
   */
  giftCardCaveat: string | null;
  trackingSpeed: string | null;
  confirmationDays: number | null;
  lastChecked: string;
}

export interface Brand {
  id: string;
  name: string;
  category: Category;
  tagline: string;
  initials: string;
  gradient: [string, string];
  keywords: string[];
  logo: string | null;
  image: string | null;
  website: string | null;
  description: string | null;
  offers: Offer[];
  /** Null when CashKaro doesn't list this brand at all. */
  cashKaro?: CashKaro | null;
}

export interface Catalog {
  generatedAt: string;
  sources: { id: string; name: string; homeUrl: string }[];
  platforms: Platform[];
  brands: Brand[];
}

export const KEY_FACT_ORDER = [
  'stacking',
  'clubbing',
  'validity',
  'partialUse',
] as const satisfies readonly (keyof KeyFacts)[];

export const KEY_FACT_LABELS: Record<
  keyof KeyFacts,
  { label: string; question: string; icon: string }
> = {
  stacking: {
    label: 'Multiple cards',
    question: 'Can I use more than one in a single transaction?',
    icon: 'stack',
  },
  clubbing: {
    label: 'Clubbing offers',
    question: 'Can it be combined with existing offers and coupons?',
    icon: 'merge',
  },
  validity: {
    label: 'Validity',
    question: 'How long before it expires?',
    icon: 'clock',
  },
  partialUse: {
    label: 'Partial use',
    question: 'If I spend only part of it, does the balance survive?',
    icon: 'wallet',
  },
};
