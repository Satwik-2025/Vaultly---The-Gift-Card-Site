/**
 * Named HTML entities, case-sensitive where it matters (`&Eacute;` vs `&eacute;`).
 *
 * Sellers write these literally in their terms text — GyFTR bullets its terms
 * with `&bull;` and Woohoo spells the brand `Cin&eacute;polis` — so an incomplete
 * table leaks raw entity names into the rendered T&C.
 */
const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',

  // Punctuation and symbols
  bull: '•',
  middot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  lsaquo: '‹',
  rsaquo: '›',
  laquo: '«',
  raquo: '»',
  prime: '′',
  Prime: '″',
  trade: '™',
  reg: '®',
  copy: '©',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  minus: '−',
  ne: '≠',
  le: '≤',
  ge: '≥',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  para: '¶',
  sect: '§',
  iexcl: '¡',
  iquest: '¿',
  brvbar: '¦',
  uml: '¨',
  macr: '¯',
  acute: '´',
  cedil: '¸',
  ordf: 'ª',
  ordm: 'º',
  not: '¬',
  shy: '',
  curren: '¤',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  rupee: '₹',
  inr: '₹',
  larr: '←',
  rarr: '→',
  harr: '↔',
};

// Latin-1 letters map cleanly onto code points 192–255, so build rather than type.
const LATIN1_NAMES =
  'Agrave,Aacute,Acirc,Atilde,Auml,Aring,AElig,Ccedil,Egrave,Eacute,Ecirc,Euml,Igrave,Iacute,Icirc,Iuml,ETH,Ntilde,Ograve,Oacute,Ocirc,Otilde,Ouml,times,Oslash,Ugrave,Uacute,Ucirc,Uuml,Yacute,THORN,szlig,agrave,aacute,acirc,atilde,auml,aring,aelig,ccedil,egrave,eacute,ecirc,euml,igrave,iacute,icirc,iuml,eth,ntilde,ograve,oacute,ocirc,otilde,ouml,divide,oslash,ugrave,uacute,ucirc,uuml,yacute,thorn,yuml'.split(
    ',',
  );
LATIN1_NAMES.forEach((name, i) => {
  ENTITIES[name] ??= String.fromCodePoint(192 + i);
});

export function decodeEntities(s) {
  let out = String(s ?? '');

  // Two passes, because some sellers double-encode: "&amp;bull;" only becomes a
  // real bullet once "&amp;" has already collapsed to "&".
  for (let pass = 0; pass < 2; pass++) {
    const before = out;
    out = out
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      // Case-sensitive lookup first (&Eacute; != &eacute;), then lower-case.
      .replace(
        /&([a-zA-Z][a-zA-Z0-9]{1,10});/g,
        (m, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? m,
      );
    if (out === before) break;
  }

  return out;
}

/** HTML -> readable plain text, preserving list items as separate lines. */
export function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      // Some sellers embed terms inside JSON strings, so the text arrives with
      // literal backslash-n rather than real newlines. Normalise before parsing.
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<li[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Site-wide legalese that is not about the gift card and only adds noise. */
const BOILERPLATE =
  /reverse engineer|intellectual property rights|indemnif|governed by and construed|conflict of laws|exclusive jurisdiction|courts at |report to support@|links to third party|disclaimer of warranties|terms of use of the website|suspend or terminate your use|these terms will survive|computer equipments|non-commercial use only and shall not re-sell|shipper\s*\/\s*seller|^\(?[ivxlcdm]+\)?$|^[A-Z]\.\s|^(customer care|helpline|contact us|about the brand)\b|^(see more|read more|show details)|secure transaction|payment security system|out of \d+ stars|see more product details|we don.t share your credit card|encrypts your information|^(brand|manufacturer|item weight|asin|country of origin)\s*:/i;

/** HTML list/paragraph -> array of clean bullet strings. */
export function htmlToBullets(html) {
  const seen = new Set();
  return (
    htmlToText(html)
      // Some sellers bullet a single paragraph with • characters rather than
      // using <li>, so treat a bullet as a line break too.
      .split(/\n|\s*[•·]\s*/)
      .map((l) =>
        l
          // Strip leading bullets and stray list markers like "(xi)" or "G."
          .replace(/^[•·\-–—\s]+/, '')
          .replace(/^\((?:[ivxlcdm]+|\d{1,2})\)\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter((l) => {
        if (l.length < 20 || l.length > 400) return false;
        if (BOILERPLATE.test(l)) return false;
        // A leftover entity means this is still half-parsed markup, not prose.
        if (/&[a-zA-Z#][a-zA-Z0-9]*;/.test(l)) return false;
        // Needs to read like a sentence, not a heading or fragment.
        if (!/\s/.test(l) || !/[a-z]/.test(l)) return false;
        const key = l.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 16)
  );
}

/**
 * Canonical key used to merge the same brand across sellers.
 * "HealthKart" / "Healthkart E-Gift Card" / "DOMINO'S" all collapse correctly.
 */
export function brandKey(name) {
  return decodeEntities(name)
    .toLowerCase()
    // Strip apostrophes rather than treating them as separators, so
    // "DOMINO'S" becomes "dominos" and merges with other sellers' spelling.
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(
      /\b(e[- ]?gift|gift|instant|digital|online|top[- ]?up|egv|gv|voucher|vouchers|card|cards|pay)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/** Human-facing display name, cleaned of seller boilerplate. */
export function cleanBrandName(name) {
  const s = decodeEntities(name)
    .replace(/\s*[-|]\s*(e[- ]?gift|gift)\s*(card|voucher)s?.*$/i, '')
    .replace(/\b(e[- ]?gift\s*(card|voucher)s?|instant\s*vouchers?|gift\s*(card|voucher)s?)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    // "Zee5 Tamil 12M E-Gift Card" leaves a dangling "E" once the suffix goes.
    .replace(/\s+[A-Za-z]$/, '')
    .replace(/[\s-]+$/, '')
    .trim();
  return s || decodeEntities(name).trim();
}
