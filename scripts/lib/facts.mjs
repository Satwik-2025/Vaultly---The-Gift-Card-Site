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
/**
 * Several cards are allowed, but only by first pooling them somewhere — not
 * by entering them one after another at checkout. Worth saying, because it's
 * an extra step a buyer wouldn't expect.
 *
 * `where` is the seller's own name for it, e.g. "Air India Wallet".
 */
const viaPool = (where) => {
  const bare = where.replace(/^(?:the|your|a)\s+/i, '').trim();
  // "e-Pay balance" is GyFTR's own wallet; say whose.
  const name = /^e-?pay\b/i.test(bare) ? `GyFTR ${bare}` : bare;
  return {
    status: 'good',
    headline: `Multiple cards · via ${name}`,
    detail: `Several cards can be used in one order, but first add them all to your ${name} — you then pay from that balance, rather than entering each card at checkout.`,
  };
};

const STACKING_RULES = [
  {
    // Woohoo, Air India Ancillary: "To use multiple Ancillary Gift Cards in a
    // single transaction, add all Gift Cards to the Air India Wallet."
    // GyFTR, Air India: "To use multiple GV/GCs at once, add them to your Air
    // India Wallet".
    re: /\bto\s+use\s+multiple\b[^.]{0,60}?\b(?:single|one|same|at\s+once|together)\b[^.]{0,30}?\b(?:add|load|transfer)\b[^.]{0,30}?\bto\s+((?:the\s+|your\s+)?[a-z][\w&' -]{1,40}?\b(?:wallet|balance|account))\b/i,
    build: (m) => viaPool(m[1]),
  },
  {
    // GyFTR: "Multiple Gift Vouchers CAN be combined & added to e-Pay balance."
    re: /multiple[^.]{0,60}?(?:gift\s*cards?|vouchers?|gvs?|egvs?)[^.]{0,60}?\bcombined\b\s*(?:&|and)\s*added\s+to\s+((?:the\s+|your\s+|a\s+)?[a-z][\w&' -]{1,30}?\b(?:wallet|balance|account|credits?))\b/i,
    build: (m) => viaPool(m[1]),
  },
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
    re: /multiple[^.]{0,60}?\b(?:can\s*not|cannot|can't|shall not|may not)\b[^.]{0,60}?\b(?:one|single|same)\b[^.]{0,30}?\b(?:bill|transaction|order|purchase|invoice|booking)/i,
    build: () => ({
      status: 'bad',
      headline: 'One card per transaction',
      detail: 'Only a single voucher can be applied per order — leftover cards wait for another purchase.',
    }),
  },
  {
    // "up to 5 gift vouchers can be used", "Upto 5 E-Gift Card", "Only 5 Croma
    // EGV" — a brand name can sit between the number and the card.
    re: /\b(?:up\s*to|maximum\s*(?:of)?|max(?:imum)?|only)\s*(\d{1,2})\s*(?:[a-z&']+\s+){0,2}?(?:gvs?|egvs?|gcs?|e[-‑]?gift\s*(?:cards?|vouchers?)?|gift\s*(?:vouchers?|cards?)|vouchers?|cards?)\b/i,
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
    // "User cannot club more than 1 Gift Card in one order", "1 gift card to be
    // redeemed against 1 bill only", "a limit of 1 gift card per day".
    re: /\b(?:can\s*not|cannot|can't)\s+(?:club|combine|use|apply)\s+more\s+than\s+1\b|\b1\s+(?:e[-‑]?)?(?:gift\s*)?(?:cards?|vouchers?|gvs?|egvs?)\b[^.]{0,40}?\bagainst\s+(?:1|one|a\s+single)\s+(?:bill|transaction|order|purchase|invoice|booking)|\blimit\s+of\s+1\s+(?:e[-‑]?)?(?:gift\s*)?(?:cards?|vouchers?)/i,
    build: () => ({
      status: 'bad',
      headline: 'One card per transaction',
      detail: 'Only a single voucher can be applied per order — leftover cards wait for another purchase.',
    }),
  },
  {
    // "More than one GV / GC can be used in one bill"
    re: /\bmore\s+than\s+1\b[^.]{0,30}?\b(?:can|may)\b[^.]{0,40}?\b(?:one|single|same|a)\b[^.]{0,20}?\b(?:bill|transaction|order|purchase|invoice|booking)/i,
    build: () => ({
      status: 'good',
      headline: 'Multiple cards allowed',
      detail: 'Several vouchers can be combined in a single transaction.',
    }),
  },
  {
    // "Multiple vouchers can be used in one transaction"
    re: /multiple[^.]{0,60}?\b(?:can|may)\b[^.]{0,60}?\b(?:one|single|same)\b[^.]{0,30}?\b(?:bill|transaction|order|purchase|invoice|booking)/i,
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
    // "Gift Vouchers CANNOT be used to buy discounted merchandise" (about 50
    // GyFTR cards), "Gift cards CANNOT be used during Sale on discounted products".
    re: /\b(?:can\s*not|cannot|can't|not)\b[^.]{0,20}?\bbe\s+used\b[^.]{0,40}?\b(?:discounted|sale)\b/i,
    build: () => ({
      status: 'bad',
      headline: 'Not valid on discounted items',
      detail: 'Excluded from sale-priced products and promotional pricing.',
    }),
  },
  {
    // "Different Offers/vouchers cannot be combined", "No other offers,
    // discounts, promotions … are valid with this deal", "Clubbing and
    // Partial Redemption are not allowed".
    re: /\boffers?\b[^.]{0,30}?\b(?:can\s*not|cannot|can't)\s+be\s+(?:combined|club(?:bed)?)\b|\bno\s+other\s+(?:offers?|discounts?|promotions?)\b[^.]{0,60}?\bvalid\b|\bclubbing\b[^.]{0,40}?\b(?:not\s+(?:allowed|permitted)|is\s+not\b)/i,
    build: () => ({
      status: 'bad',
      headline: 'Cannot be clubbed with offers',
      detail: 'Using this voucher blocks other coupons and promotional pricing on the same order.',
    }),
  },
  {
    // "club" as well as "clubbed": "This voucher cannot be club with any other offers".
    re: /\b(?:can\s*not|cannot|can't|shall not|may not|not)\b[^.]{0,60}?\b(?:combined|club(?:bed)?|used in conjunction)\b[^.]{0,50}?\b(?:offers?|promotions?|discounts?|coupons?|sales?)/i,
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
    // "Gift Voucher/e-Pay CAN be used during the Sale", "Redeemable during End
    // of Season Sales, Promotions & Offers".
    re: /\b(?:can|may)\s+be\s+used\s+during\s+(?:the\s+)?(?:end\s+of\s+season\s+)?sales?\b|\bredeemable\s+during\b[^.]{0,30}?\bsales?\b/i,
    build: () => ({
      status: 'good',
      headline: 'Works during sales',
      detail: 'Can be spent on sale and promotional pricing.',
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
    // Reaches 70 characters: "The validity of your Tata Cliq gift voucher
    // from GyFTR is between 6 months" puts the number 52 characters along.
    re: /\b(?:valid(?:ity)?|expir\w*)\b[^.]{0,70}?\b(\d{1,3})\s*(day|days|month|months|year|years)\b/i,
    build: (m) => {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      const months = unit.startsWith('year') ? n * 12 : unit.startsWith('month') ? n : n / 30;
      return {
        status: months >= 12 ? 'good' : months >= 6 ? 'limited' : 'bad',
        // Say what the clock starts from when the seller does: Ajio's runs
        // from activation, which a buyer controls; "issue" would be wrong.
        headline: `${n} ${unit.replace(/s$/, '')}${n === 1 ? '' : 's'} from ${
          /activation/i.test(m.input ?? '') ? 'activation' : /purchase/i.test(m.input ?? '') ? 'purchase' : 'issue'
        }`,
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
    // Amazon listings sold by GyFTR: "The validity of the Gift Cards that GyFTR
    // offer depends on the value and the brand. We provide this detail with
    // the voucher."
    re: /\bvalidity\b[^.]{0,80}?\bdepends\s+on\b|\bprovide\s+(?:this|the|these)\s+(?:detail|details|validity)\b[^.]{0,30}?\bwith\s+the\s+(?:voucher|gift\s*card|e-?gift)/i,
    build: () => ({
      status: 'limited',
      headline: 'Varies — printed on the voucher',
      detail: 'Depends on the card; the expiry date arrives with the voucher itself.',
    }),
  },
  {
    // "Gift Cards are valid until the date mentioned on the Gift Cards"
    re: /\bvalid\s+(?:until|till|up\s*to)\s+the\s+(?:expiry\s+)?date\s+(?:mentioned|printed|stated|given)\b/i,
    build: () => ({
      status: 'limited',
      headline: 'Varies — printed on the voucher',
      detail: 'No fixed period is published; the expiry date is on the card itself.',
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
    // "This e-Gift card is allowed for one-time redemption only", "If the value
    // of the purchase is less than the value of the e-Gift card, the balance
    // amount is non-refundable".
    re: /\bone[-\s]?time\s+redemption\b|\b(?:redeemable|redeemed|used)\s+only\s+once\b|\bbalance(?:\s+amount)?\s+(?:is|will\s+be)\s+non[-\s]?refundable\b/i,
    build: () => ({
      status: 'bad',
      headline: 'Single use only',
      detail: 'The whole value goes in one transaction — anything left over is lost.',
    }),
  },
  {
    // "Any balance amount left on the used Gift Cards can be reused within the
    // validity period", "…the outstanding balance … will reflect under the same
    // Gift Card and can be used for subsequent transactions", "can be redeemed
    // on one or more occasions", "valid for multiple/partial redemption".
    re: /\bbalance\b[^.]{0,60}?\bcan\s+be\s+re-?used\b|\boutstanding\s+balance\b[^.]{0,120}?\bsubsequent\s+transactions?\b|\bredeemed\s+on\s+one\s+or\s+more\s+occasions\b|\bvalid\s+for\s+multiple\s*\/\s*partial\s+redemption\b/i,
    build: () => ({
      status: 'good',
      headline: 'Balance carries forward',
      detail: 'Spend part of it and the remainder stays usable for a later order.',
    }),
  },
  {
    // "Gift Voucher CANNOT be used multiple times" — GyFTR's wording for a
    // single-use voucher. Has to come before the rule below, which would
    // otherwise read the same sentence as the opposite.
    re: /\b(?:can\s*not|cannot|can't|not)\b\s+(?:be\s+)?(?:used|redeemed)(?:\s*\/\s*redeemed)?[^.]{0,30}?multiple\s+times/i,
    build: () => ({
      status: 'bad',
      headline: 'Single use only',
      detail: 'The whole value goes in one transaction — anything left over is lost.',
    }),
  },
  {
    // "The Beyoung GV can be used/redeemed multiple times"
    reject: /\b(?:can\s*not|cannot|can't|not)\b\s+(?:be\s+)?(?:used|redeemed)[^.]{0,30}?multiple\s+times/i,
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
    // "The card supports full or partial redemption"
    re: /\b(?:supports?|allows?|permits?)\b[^.]{0,40}?\bpartial\s+redemption\b/i,
    build: () => ({
      status: 'good',
      headline: 'Partial redemption allowed',
      detail: 'Spend part of the card now and the rest later.',
    }),
  },
  {
    // "This is a one-time-use GV/GC."
    // Not "any unused balance will lapse after expiry": that's about expiry,
    // which validity already covers, and says nothing about spending part of it.
    reject: /\b(?:after|on|upon|post|beyond)\s+(?:the\s+)?(?:expiry|expiration|validity)\b/i,
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
 * Air India on GyFTR: "Up to 3 Gift Vouchers CAN be used in one bill when the
 * entire order value is paid using Gift Vouchers. Up to 2 … along with another
 * payment method." A card cap often has that second, lower limit for when the
 * vouchers don't cover the whole bill — worth saying, since it's the usual case.
 */
function refineCardLimit(fact, sents) {
  const n = Number(fact?.headline.match(/^Up to (\d+) cards/)?.[1]);
  if (!n) return fact;
  for (const s of sents) {
    const m = s.match(
      /\bup\s*to\s*(\d{1,2})\b[^.]{0,60}?\b(?:along\s+with|with|plus)\b[^.]{0,30}?\b(?:another|other|any other)\b[^.]{0,20}?\bpayment/i,
    );
    const k = Number(m?.[1]);
    if (k && k < n) {
      return {
        ...fact,
        headline: `Up to ${n} cards · ${k} if you pay part another way`,
        detail: `${n} vouchers when they cover the whole bill; only ${k} when the rest is paid by card, UPI or similar.`,
        source: `${fact.source} ${s}`,
      };
    }
  }
  return fact;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, eighteen: 18, thirty: 30, sixty: 60, ninety: 90,
};

const NUMBERED_WORD = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).join('|')})(?=\\s*(?:\\(\\d+\\)\\s*)?` +
    // …followed by a period ("one year") or a card ("only one Gift Card").
    `(?:day|days|month|months|year|years|gift\\s*cards?|gift\\s*vouchers?|e-?gift|cards?|vouchers?|gvs?|egvs?|gcs?)\\b)`,
  'gi',
);

/**
 * Same as `findFirst`, but numbers written as words count too. Woohoo's
 * Cinépolis terms say "Only one Gift Card can be applied … against each
 * transaction"; Lulu's Amazon listing says "valid only for one year". The
 * rules run on a copy with digits, and the quote shown is the seller's own.
 */
function findWithNumbers(sents, rules) {
  const numbered = sents.map((s) => s.replace(NUMBERED_WORD, (w) => String(NUMBER_WORDS[w.toLowerCase()])));
  const fact = findFirst(numbered, rules);
  if (!fact) return null;
  const i = numbered.indexOf(fact.source);
  return i === -1 ? fact : { ...fact, source: sents[i] };
}

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
    stacking: refineCardLimit(findWithNumbers(sents, STACKING_RULES), sents) ??
      unknown('whether multiple cards can be combined'),
    clubbing:
      findWithNumbers(sents, CLUBBING_RULES) ?? unknown('whether it can be clubbed with other offers'),
    validity: findWithNumbers(sents, VALIDITY_RULES) ?? unknown('a validity period'),
    partialUse:
      partial ??
      findWithNumbers(sents, PARTIAL_RULES) ??
      unknown('what happens to an unused balance'),
  };
}

/**
 * Re-reads an offer's stored terms with today's rules.
 *
 * For offers a run carries over without re-fetching — Amazon's, on any day
 * Amazon blocks the scrape — so a rule that learns a new phrasing ("valid for
 * one year…", "only one Gift Card … per transaction") or stops misreading one
 * still reaches them. A fact the re-read can't answer keeps its stored
 * answer: that came from the full page text, the stored terms are a summary.
 */
export function refreshFactsFromTerms(offer) {
  if (!offer.otherTerms?.length || !offer.keyFacts) return offer;
  const reread = deriveKeyFacts([offer.otherTerms.join('\n')]);
  const keyFacts = { ...offer.keyFacts };
  for (const k of Object.keys(keyFacts)) {
    if (reread[k] && reread[k].status !== 'unknown') keyFacts[k] = reread[k];
  }
  return { ...offer, keyFacts };
}

/** How many of the four we actually managed to answer — a data-quality signal. */
export const factCoverage = (facts) =>
  Object.values(facts).filter((f) => f.status !== 'unknown').length;
