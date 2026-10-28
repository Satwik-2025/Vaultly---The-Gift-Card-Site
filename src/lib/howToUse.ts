import type { Offer } from '../types';

/**
 * The steps for redeeming a seller's card, when it publishes them.
 *
 * Woohoo and GyFTR give them to the scraper as their own list (`howToUse`).
 * Amazon has no separate field: its steps sit inside the listing's text, which
 * already arrives as `otherTerms` — "# HOW TO REDEEM : STEP 1: Go to the
 * account section… STEP 2: Click on Add…". They're split back out here, so
 * every Amazon card already in the catalog gets them without a fresh scrape.
 */
export function howToUseSteps(offer: Offer): string[] {
  if (offer.howToUse?.length) return offer.howToUse;

  const lines = offer.otherTerms ?? [];
  const start = lines.findIndex(
    (l) => /\bhow to (redeem|use)\b/i.test(l) || /^\s*#?\s*step\s*1\b/i.test(l),
  );
  if (start === -1) {
    // "To redeem, visit - appstore.com/redeem" — a one-line instruction.
    const single = lines.find((l) => /^\s*to redeem\b/i.test(l));
    return single ? [single.replace(/^\s*to redeem,?\s*/i, '').replace(/^visit\s*-\s*/i, 'Visit ')] : [];
  }

  // The heading line plus the "STEP n" lines that follow it.
  const block = [lines[start]];
  for (const l of lines.slice(start + 1)) {
    if (!/^\s*#?\s*step\s*\d/i.test(l)) break;
    block.push(l);
  }

  return block
    .join(' ')
    .replace(/^.*?\bhow to (redeem|use)\b[^:\-–]*[:\-–]\s*/i, '')
    .split(/\bstep\s*\d{1,2}\s*(?:\([^)]*\))?\s*[:.\-–]?\s*/i)
    .map((s) => s.replace(/^#\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 3)
    .slice(0, 12);
}
