/**
 * Derives the four decision-critical facts from a seller's own terms text.
 *
 * Design rule: never invent an answer. Every fact carries the sentence it was
 * derived from, and anything the seller doesn't state comes back as `unknown`
 * rather than a plausible guess.
 *
 * The patterns are mined from the sellers' real wording rather than imagined —
 * e.g. ~35 GyFTR brands say "shall be invalid after the date mentioned…", and
 * ~20 say "multiple gift cards can be combined and added to the ePay balance".
 */

const unknown = (label) => ({
  status: 'unknown',
  headline: 'Not stated',
  detail: `The seller's listing doesn't state ${label}. Confirm on their page before paying.`,
  source: null,
});

/** Split into sentence-ish units so a matched rule can quote its evidence. */
function sentences(text) {
  return text
    .split(/\n|(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function findFirst(sents, rules) {
  for (const s of sents) {
    for (const rule of rules) {
      if (rule.reject?.test(s)) continue;
      const m = s.match(rule.re);
      if (m) return { ...rule.build(m, s), source: s };
    }
  }
  return null;
}

// --- 1. Multiple cards in a single transaction -------------------------------
const STACKING_RULES = [
  {
    // "Multiple gift cards can be combined and added to the ePay balance"
    re: /multiple[^.]{0,60}?(?:gift\s*cards?|vouchers?|gvs?|egvs?)[^.]{0,60}?(?:can\s+be\s+)?combined/i,
    build: () => ({
      status: 'good',
      headline: 'Multiple cards allowed',
      detail: 'Several cards can be combined into one balance and spent together.',
    }),
  },
  {
    re: /balance[^.]{0,60}?can\s+be\s+used[^.]{0,50}?multiple\s+transactions/i,
    build: () => ({
      status: 'good',
      headline: 'Usable across many orders',
      detail: 'The balance can be spent over multiple transactions, any amount at a time.',
    }),
  },
  {
    re: /can\s+be\s+used[^.]{0,40}?multiple\s+times[^.]{0,60}?(?:balance|e-?pay|wallet|credits?)/i,
    build: () => ({
      status: 'good',
      headline: 'Multiple cards allowed',
      detail: 'Once converted to a balance it can be drawn on repeatedly.',
    }),
  },
  {
    re: /single[^.]{0,40}?(?:gift\s*card|voucher|gv)[^.]{0,40}?in\s+one\s+bill/i,
    build: () => ({
      status: 'bad',
      headline: 'One card per transaction',
      detail: 'Only a single voucher can be applied per bill.',
    }),
  },
  {
    // "Multiple GVs cannot be used in one bill/transaction"
    re: /multiple[^.]{0,60}?\b(?:can\s*not|cannot|can't|shall not|may not)\b[^.]{0,60}?\b(?:one|single|same)\b[^.]{0,30}?\b(?:bill|transaction|order|purchase)/i,
    build: () => ({
      status: 'bad',
      headline: 'One card per transaction',
      detail: 'Only a single voucher can be applied per order — leftover cards wait for another purchase.',
    }),
  },
  {
    // "up to 5 gift vouchers can be used"
    re: /\b(?:up\s*to|maximum\s*(?:of)?|max(?:imum)?|only)\s*(\d{1,2})\s*(?:gvs?|egvs?|gift\s*(?:vouchers?|cards?)|vouchers?|cards?)/i,
    build: (m) => {
      const n = Number(m[1]);
      if (n <= 1) {
        return {
          status: 'bad',
          headline: 'One card per transaction',
          detail: 'Only a single voucher can be applied per order.',
        };
      }
      return {
        status: n >= 5 ? 'good' : 'limited',
        headline: `Up to ${n} cards per transaction`,
        detail:
          n >= 5
            ? `As many as ${n} vouchers can be combined in a single order.`
            : `Capped at ${n} — a large balance means splitting your order.`,
      };
    },
  },
  {
    // "Multiple vouchers can be used in one transaction"
    re: /multiple[^.]{0,60}?\bcan\b[^.]{0,60}?\b(?:one|single|same)\b[^.]{0,30}?\b(?:bill|transaction|order|purchase)/i,
    build: () => ({
      status: 'good',
      headline: 'Multiple cards allowed',
      detail: 'Several vouchers can be combined in a single transaction.',
    }),
  },
  {
    re: /multiple[^.]{0,40}?(?:vouchers?|gvs?|cards?)[^.]{0,40}?\b(?:allowed|permitted|accepted)\b/i,
    build: () => ({
      status: 'good',
      headline: 'Multiple cards allowed',
      detail: 'Several vouchers can be combined in a single transaction.',
    }),
  },
];

// --- 2. Clubbing with existing offers ---------------------------------------
const CLUBBING_RULES = [
  {
    re: /\b(?:can\s*not|cannot|can't|shall not|may not|not)\b[^.]{0,60}?\b(?:combined|clubbed|used in conjunction)\b[^.]{0,50}?\b(?:offers?|promotions?|discounts?|coupons?|sales?)/i,
    build: () => ({
      status: 'bad',
      headline: 'Cannot be clubbed with offers',
      detail: 'Using this voucher blocks other coupons and promotional pricing on the same order.',
    }),
  },
  {
    // "The GVs can be clubbed with ongoing sales"
    re: /\b(?:can|may)\b[^.]{0,50}?\bbe\s+(?:combined|clubbed)\b[^.]{0,60}?\b(?:offers?|promotions?|discounts?|sales?|cash\s*back|promotion)/i,
    build: () => ({
      status: 'good',
      headline: 'Stacks with existing offers',
      detail: 'Can be combined with running discounts, sales and promotions.',
    }),
  },
  {
    // "Gift Vouchers CAN be used to buy discounted products"
    re: /\bcan\b[^.]{0,40}?\bbe\s+used\b[^.]{0,40}?\b(?:on|to\s+buy|for)\b[^.]{0,30}?\bdiscounted\b/i,
    build: () => ({
      status: 'limited',
      headline: 'Works on discounted products',
      detail: 'Valid on sale-priced items; promo codes may still be excluded.',
    }),
  },
  {
    re: /\bnot\s+(?:valid|applicable)\b[^.]{0,50}?\b(?:discounted|sale|offer)\b/i,
    build: () => ({
      status: 'bad',
      headline: 'Not valid on discounted items',
      detail: 'Excluded from sale-priced products and promotional pricing.',
    }),
  },
];

// --- 3. Validity -------------------------------------------------------------
const VALIDITY_RULES = [
  {
    re: /\b(?:valid(?:ity)?|expir\w*)\b[^.]{0,50}?\b(\d{1,3})\s*(day|days|month|months|year|years)\b/i,
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const months = unit.startsWith('year') ? n * 12 : unit.startsWith('month') ? n : n / 30;
      return {
        status: months >= 12 ? 'good' : months >= 6 ? 'limited' : 'bad',
        headline: `${n} ${unit.replace(/s$/, '')}${n === 1 ? '' : 's'} from issue`,
        detail:
          months >= 12
            ? 'A comfortable window — no real pressure to rush the purchase.'
            : 'A short window. Plan what you intend to buy before purchasing.',
      };
    },
  },
  {
    re: /\b(\d{1,3})\s*(day|days|month|months|year|years)\b[^.]{0,30}?\b(?:valid|validity|from the date)/i,
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const months = unit.startsWith('year') ? n * 12 : unit.startsWith('month') ? n : n / 30;
      return {
        status: months >= 12 ? 'good' : months >= 6 ? 'limited' : 'bad',
        headline: `${n} ${unit.replace(/s$/, '')}${n === 1 ? '' : 's'} from issue`,
        detail: months >= 12 ? 'A comfortable redemption window.' : 'A short window — plan ahead.',
      };
    },
  },
  {
    re: /\b(?:no\s+expiry|never\s+expires?|lifetime\s+validity)\b/i,
    build: () => ({
      status: 'good',
      headline: 'No expiry',
      detail: 'The balance stays available indefinitely.',
    }),
  },
  {
    // "The GV shall be invalid after the date mentioned in the details received
    // with the GV via SMS/Email/WhatsApp" — the single most common phrasing.
    re: /(?:shall|will|would)\s+be\s+invalid[^.]{0,70}?date\s+mentioned|redeem[^.]{0,50}?before\s+(?:its\s+|the\s+)?validity\s+date/i,
    build: () => ({
      status: 'limited',
      headline: 'Varies — printed on the voucher',
      detail: 'No fixed period is published; the expiry date arrives with the voucher itself.',
    }),
  },
  {
    // Seller defers to the voucher itself.
    re: /\b(?:validity|expiry|expiration)\b[^.]{0,70}?\b(?:mentioned|printed|specified|indicated|displayed|as per)\b/i,
    build: () => ({
      status: 'limited',
      headline: 'Varies — printed on the voucher',
      detail: 'The seller does not publish a fixed period; the expiry is stated on the voucher itself.',
    }),
  },
];

// --- 4. Partial use / leftover balance ---------------------------------------

/**
 * Checked against the whole text before the sentence scan.
 *
 * Order matters here in a way per-sentence rules can't express: Myntra says
 * "The Gift Card can be redeemed only once." and *then* "once added to Myntra
 * Credits…". Scanning sentence-by-sentence, the first sentence wins and the
 * card is wrongly marked single-use, when the value plainly survives.
 */
const PARTIAL_GLOBAL_RULES = [
  {
    re: /(?:balance|value|amount)[^.]{0,60}?(?:can\s+be\s+used|sits|stays|remains)[^.]{0,60}?(?:partially|multiple\s+times|over\s+multiple)/i,
    build: () => ({
      status: 'good',
      headline: 'Balance carries forward',
      detail: 'Spend part of it and the remainder stays usable for a later order.',
    }),
  },
  {
    // "once added to Myntra Credits", "added to your ePay balance", "HK Cash"
    re: /(?:added?|credited?|converted?|loaded|sits)[^.]{0,50}?(?:e-?pay\s+balance|wallet\s+balance|hk\s*cash|[a-z]+\s+credits?|store\s+credit|account\s+balance)/i,
    build: () => ({
      status: 'good',
      headline: 'Balance stays in your account',
      detail: 'The card tops up an account balance, so anything unspent simply remains there.',
    }),
  },
];

const PARTIAL_RULES = [
  {
    // "The Beyoung GV can be used/redeemed multiple times"
    re: /(?:used|redeemed)(?:\s*\/\s*redeemed)?[^.]{0,30}?multiple\s+times/i,
    build: () => ({
      status: 'good',
      headline: 'Balance carries forward',
      detail: 'It can be drawn on more than once until the value runs out.',
    }),
  },
  {
    re: /balance[^.]{0,40}?can\s+be\s+used[^.]{0,30}?partially/i,
    build: () => ({
      status: 'good',
      headline: 'Partial redemption allowed',
      detail: 'You need not spend the full value in one go.',
    }),
  },
  {
    re: /\b(?:balance|remaining|residual|unused)\b[^.]{0,60}?\b(?:carried forward|carry forward|retained|remains?|can be used|available for)\b/i,
    // "If any balance remains, select Pay in Cash" is about settling the rest of
    // the *bill*, not the voucher's leftover value — a different question.
    reject: /pay\s+(?:for\s+)?(?:in\s+cash|the\s+balance|the\s+difference|the\s+remaining)|complete\s+the\s+payment|balance\s+amount[^.]{0,30}?(?:can|must|has\s+to|by)\s+/i,
    build: () => ({
      status: 'good',
      headline: 'Balance carries forward',
      detail: 'Spend part of it and the remainder stays usable for a later order.',
    }),
  },
  {
    re: /\bpartial(?:ly)?\s*(?:redemption|redeemed|use|used)\b[^.]{0,40}?\b(?:allowed|permitted|possible)\b/i,
    build: () => ({
      status: 'good',
      headline: 'Partial redemption allowed',
      detail: 'You need not spend the full face value in one go.',
    }),
  },
  {
    re: /\bpartial(?:ly)?\s*(?:redemption|use)\b[^.]{0,40}?\b(?:not\s+allowed|not\s+permitted|prohibited)\b/i,
    build: () => ({
      status: 'bad',
      headline: 'Partial use not allowed',
      detail: 'The full face value must be redeemed in a single transaction.',
    }),
  },
  {
    // "This is a one-time-use GV/GC."
    re: /(?:single|one)[-\s]?time[-\s]?use|must be (?:used|redeemed) in (?:one|a single) (?:transaction|bill|go)|no\s+(?:balance|refund)\s+(?:will be)?\s*(?:carried|retained|returned)|(?:balance|remaining|unused)[^.]{0,50}?(?:lapse[sd]?|forfeit\w*|lost|not be refunded|cannot be used)/i,
    build: () => ({
      status: 'bad',
      headline: 'Unused balance is lost',
      detail: 'Single-use voucher — spend less than face value and the difference is forfeited.',
    }),
  },
  {
    // "You can only use/redeem your GV only once"
    re: /(?:use|used|redeem|redeemed)(?:\s*\/\s*redeem(?:ed)?)?[^.]{0,40}?only\s+once|can\s+be\s+used\s+only\s+once/i,
    build: () => ({
      status: 'bad',
      headline: 'Single use only',
      detail: 'The card is consumed on first use — spend less than face value and the rest is lost.',
    }),
  },
  {
    // Wallet-style products: the card tops up a balance, so leftovers survive.
    re: /\b(?:added?|credited?|converted?|loaded)\b[^.]{0,50}?\b(?:wallet|hk\s*cash|e-?pay|account balance|store credit)\b/i,
    build: () => ({
      status: 'good',
      headline: 'Balance stays in your account',
      detail: 'The card tops up an account balance, so anything unspent simply remains there.',
    }),
  },
];

/**
 * @param {string[]} textBlocks - terms, instructions, redemption steps and FAQs.
 */
export function deriveKeyFacts(textBlocks) {
  const text = textBlocks.filter(Boolean).join('\n');
  const sents = sentences(text);

  // Whole-text rules run first — see PARTIAL_GLOBAL_RULES.
  let partial = null;
  for (const rule of PARTIAL_GLOBAL_RULES) {
    const m = text.match(rule.re);
    if (m) {
      partial = { ...rule.build(m, m[0]), source: sents.find((s) => rule.re.test(s)) ?? m[0].trim() };
      break;
    }
  }

  return {
    stacking: findFirst(sents, STACKING_RULES) ?? unknown('whether multiple cards can be combined'),
    clubbing:
      findFirst(sents, CLUBBING_RULES) ?? unknown('whether it can be clubbed with other offers'),
    validity: findFirst(sents, VALIDITY_RULES) ?? unknown('a validity period'),
    partialUse:
      partial ?? findFirst(sents, PARTIAL_RULES) ?? unknown('what happens to an unused balance'),
  };
}

/** How many of the four we actually managed to answer — a data-quality signal. */
export const factCoverage = (facts) =>
  Object.values(facts).filter((f) => f.status !== 'unknown').length;
