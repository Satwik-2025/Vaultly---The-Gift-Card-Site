import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../components/Icon';
import { SitePanel } from '../components/SitePanel';
import { KeyFactsCompare } from '../components/KeyFactsCompare';
import { TermsSection } from '../components/TermsSection';
import { BrandMark } from '../components/BrandMark';
import { CashKaroCard } from '../components/CashKaroCard';
import {
  bestOffer,
  formatINR,
  formatPct,
  getBrand,
  getPlatform,
  maxSaving,
  orderedOffers,
  effectiveDiscount,
  refreshBrandLive,
} from '../services/catalog';
import type { Brand, PlatformId } from '../types';
import type { RefreshChanges } from '../services/catalog';
import { useSaved } from '../hooks/useApp';
import { scrollToId } from '../lib/scroll';
import { readPrefs } from '../lib/prefs';

const termsId = (platformId: PlatformId) => `terms-${platformId}`;

/** How stale the data must be before opening a brand page re-reads the sellers. */
const AUTO_RECHECK_AFTER_MS = 5 * 60 * 1000;

const timeAgo = (iso: string): string => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

export function BrandCompare() {
  const { brandId } = useParams<{ brandId: string }>();
  const [brand, setBrand] = useState<Brand | undefined>(() =>
    brandId ? getBrand(brandId) : undefined,
  );
  const { isSaved, toggle: toggleSaved } = useSaved();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  /** What the last live check changed, so the page can explain itself. */
  const [changes, setChanges] = useState<RefreshChanges | null>(null);
  const [delisted, setDelisted] = useState(false);

  useEffect(() => {
    setBrand(brandId ? getBrand(brandId) : undefined);
    setCheckError(null);
    setChanges(null);
    setDelisted(false);
  }, [brandId]);

  const recheck = useCallback(async () => {
    if (!brandId) return;
    setChecking(true);
    setCheckError(null);
    try {
      const result = await refreshBrandLive(brandId);
      setBrand(result.brand);
      setChanges(result.changes);
      setDelisted(result.delisted);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'Live check failed');
    } finally {
      setChecking(false);
    }
  }, [brandId]);

  /**
   * Re-read this brand from every seller as soon as the page opens, so the
   * prices, denominations and terms on screen are the ones live right now.
   *
   * Skipped when the data was already refreshed in the last few minutes —
   * opening the same card repeatedly shouldn't hammer the sellers — and when
   * it's switched off in Settings. The Re-check button works either way.
   */
  useEffect(() => {
    if (!brandId || !readPrefs().autoRecheck) return;
    const current = getBrand(brandId);
    if (!current) return;

    const freshestCheck = Math.max(
      ...current.offers.map((o) => new Date(o.lastChecked).getTime() || 0),
    );
    if (Date.now() - freshestCheck < AUTO_RECHECK_AFTER_MS) return;

    let live = true;
    setChecking(true);
    refreshBrandLive(brandId)
      .then((result) => {
        if (!live) return;
        setBrand(result.brand);
        setChanges(result.changes);
        setDelisted(result.delisted);
      })
      // Silent: a background refresh failing shouldn't shout at the user, the
      // already-loaded prices stay on screen with their real timestamp.
      .catch(() => {})
      .finally(() => {
        if (live) setChecking(false);
      });

    return () => {
      live = false;
    };
  }, [brandId]);

  const offers = useMemo(() => (brand ? orderedOffers(brand) : []), [brand]);

  const scrollTo = useCallback((elementId: string) => scrollToId(elementId), []);

  /** The full terms start folded away under the key-points table. */
  const [termsOpen, setTermsOpen] = useState(false);
  // The shortcut at the top opens them as well as scrolling there; a frame's
  // wait lets the block start opening before its position is measured.
  const openTerms = useCallback(() => {
    setTermsOpen(true);
    requestAnimationFrame(() => scrollToId('terms'));
  }, []);

  if (!brand) {
    return (
      <div className="shell pt-20 pb-24 text-center">
        <h1 className="text-3xl font-extrabold">Gift card not found</h1>
        <p className="text-muted mt-2">That brand isn't in the catalog yet.</p>
        <Link to="/search" className="btn btn-primary mt-6">
          Browse all gift cards
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const best = bestOffer(brand);

  // Every seller has dropped this card since the catalog was built. Say so
  // plainly rather than rendering an empty comparison.
  if (!best) {
    return (
      <div className="shell pt-20 pb-24 text-center">
        <h1 className="text-3xl font-extrabold">{brand.name} is no longer listed</h1>
        <p className="text-muted mx-auto mt-2 max-w-md">
          {delisted
            ? 'We just re-checked every seller and none of them stock this gift card any more, so it has been removed.'
            : "None of the sellers we track stock this gift card right now."}
        </p>
        <Link to="/search" className="btn btn-primary mt-6">
          Browse all gift cards
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const bestPlatform = getPlatform(best.platformId);

  // Oldest reading across the sellers, so a seller we couldn't reach drags the
  // stamp down instead of hiding behind a fresher one.
  const readAt = offers.reduce(
    (oldest, o) => (new Date(o.lastChecked) < new Date(oldest) ? o.lastChecked : oldest),
    best.lastChecked,
  );
  const stale = Date.now() - new Date(readAt).getTime() > AUTO_RECHECK_AFTER_MS;

  // Newest reading on the page. Each panel compares its own against this to
  // tell whether it was part of the last successful sweep.
  const latestCheck = offers.reduce(
    (newest, o) => (new Date(o.lastChecked) > new Date(newest) ? o.lastChecked : newest),
    best.lastChecked,
  );

  /*
    Everything this page reads live, as one list. CashKaro belongs here even
    though it isn't a seller — it's re-read on the same sweep, it can fail
    independently, and counting only the sellers understated what was checked.
    Brands CashKaro doesn't list simply contribute nothing.
  */
  const liveSources = [
    ...offers.map((o) => ({ name: getPlatform(o.platformId).name, at: o.lastChecked })),
    ...(brand.cashKaro ? [{ name: 'CashKaro', at: brand.cashKaro.lastChecked }] : []),
  ];

  // Split by whether each made the last sweep. A minute of slack: sources in
  // one sweep finish seconds apart.
  const latestMs = Math.max(
    new Date(latestCheck).getTime(),
    ...liveSources.map((s) => new Date(s.at).getTime()),
  );
  const lagging = liveSources.filter((s) => latestMs - new Date(s.at).getTime() > 60_000);
  const fresh = liveSources.filter((s) => !lagging.includes(s));

  return (
    <div className="pt-8 pb-8 md:pt-12">
      {/* ---------------- Brand header ---------------- */}
      <section className="shell">
        <Link
          to="/search"
          className="text-muted inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-[var(--text)]"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to search
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="glass glass-sheen relative mt-4 overflow-hidden rounded-[var(--radius-xl2)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(90% 120% at 12% 0%, ${brand.gradient[0]}40, transparent 60%)`,
            }}
          />
          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <BrandMark brand={brand} className="h-16 w-16" textClassName="text-lg" />
              <div className="min-w-0">
                <span className="chip !text-[0.65rem]">{brand.category}</span>
                <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{brand.name}</h1>
                <p className="text-muted mt-1.5 max-w-lg text-sm leading-relaxed">
                  {brand.tagline}
                </p>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 md:min-w-[16rem]">
              <p className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Best deal right now
              </p>
              <p className="font-display mt-1.5 text-2xl font-extrabold">
                {effectiveDiscount(best) > 0 ? `${formatPct(effectiveDiscount(best))}% off` : 'At face value'}
                <span className="text-muted ml-1.5 font-sans text-sm font-semibold">
                  on {bestPlatform.name}
                </span>
              </p>
              <p className="text-muted mt-1 text-xs">
                {effectiveDiscount(best) > 0
                  ? `Save up to ${formatINR(maxSaving(best))} on a single card.`
                  : 'No seller is currently discounting this card.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/*
          Freshness is the thing that makes this page trustworthy, so it gets a
          strip of its own rather than a faint line tucked beside the buttons.
          Sellers fail independently, so this reports them separately: whoever
          made the last sweep is reported as fresh, and any seller that didn't
          is named with its own age.
        */}
        <div className="glass mt-4 flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {checking && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ok)] opacity-70" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  checkError
                    ? 'bg-[var(--bad)]'
                    : lagging.length || stale
                      ? 'bg-[var(--warn)]'
                      : 'bg-[var(--ok)]'
                }`}
              />
            </span>
            {checkError ? (
              <span className="font-semibold text-[var(--bad)]">{checkError}</span>
            ) : checking ? (
              <span className="font-semibold">Re-reading every site…</span>
            ) : (
              <>
                {lagging.length === 0 ? (
                  <>
                    <span className="font-semibold">Prices read {timeAgo(readAt)}</span>
                    <span className="text-muted hidden sm:inline">
                      · live from{' '}
                      {liveSources.length === 1 ? 'the one site' : `all ${liveSources.length} sites`}
                    </span>
                  </>
                ) : (
                  <>
                    {/*
                      Only the sources that actually failed are old. Reporting
                      the oldest reading for the whole page read as "66 d ago ·
                      live from all 3 sellers", which is both alarming and
                      self-contradictory — so the laggards are named instead.
                    */}
                    <span className="font-semibold">
                      Live from {fresh.length} {fresh.length === 1 ? 'site' : 'sites'}
                    </span>
                    <span className="font-semibold text-[var(--warn)]">
                      · {lagging.map((s) => `${s.name} read ${timeAgo(s.at)}`).join(', ')}
                    </span>
                  </>
                )}
              </>
            )}
          </p>

          <button
            type="button"
            onClick={recheck}
            disabled={checking}
            className="btn btn-primary w-full !px-4 !text-xs sm:w-auto sm:!text-sm"
            title="Re-read every seller's page for this brand right now"
          >
            <Icon name="refresh" className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Re-check prices now'}
          </button>
        </div>

        {/* A live check can change which sellers are on the page, not just the
            numbers. Adding or dropping a panel silently would look like a bug,
            so the check says what it did. */}
        {changes &&
          (changes.added.length > 0 ||
            changes.removed.length > 0 ||
            changes.unavailable.length > 0 ||
            changes.unstocked.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs"
          >
            {changes.added.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--ok)]">
                <Icon name="plus" className="h-3.5 w-3.5" />
                Now also on {changes.added.map((id) => getPlatform(id).name).join(', ')}
              </span>
            )}
            {changes.removed.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--bad)]">
                <Icon name="minus" className="h-3.5 w-3.5" />
                No longer sold by {changes.removed.map((id) => getPlatform(id).name).join(', ')}
              </span>
            )}
            {changes.unstocked.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--warn)]">
                <Icon name="clock" className="h-3.5 w-3.5" />
                Sold out on {changes.unstocked.map((id) => getPlatform(id).name).join(', ')} — still listed, nothing to buy today
              </span>
            )}
            {changes.unavailable.length > 0 && (
              <span className="text-muted inline-flex items-center gap-1.5">
                <Icon name="clock" className="h-3.5 w-3.5" />
                Couldn't reach {changes.unavailable.map((id) => getPlatform(id).name).join(', ')} — showing the last known prices
              </span>
            )}
          </motion.div>
        )}

        {/* Cashback stacks on top of (or, where the terms say so, instead of)
            the gift card discount — so it belongs above the seller panels. */}
        {brand.cashKaro && <CashKaroCard cashKaro={brand.cashKaro} brandName={brand.name} />}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Same bookmark as the search cards, so saving works wherever you
              happen to be looking at the brand. */}
          <button
            type="button"
            onClick={() => toggleSaved(brand.id)}
            aria-pressed={isSaved(brand.id)}
            className="btn btn-glass !px-3 !text-xs sm:!px-5 sm:!text-sm"
          >
            <Icon
              name="bookmark"
              className="h-4 w-4"
              strokeWidth={isSaved(brand.id) ? 2.2 : 1.7}
              fill={isSaved(brand.id) ? 'currentColor' : 'none'}
            />
            {isSaved(brand.id) ? 'Saved' : 'Save card'}
          </button>

          <button
            type="button"
            onClick={openTerms}
            className="btn btn-glass !px-3 !text-xs sm:!px-5 sm:!text-sm"
          >
            <Icon name="chevronDown" className="h-4 w-4" />
            Terms &amp; conditions
          </button>
          <button
            type="button"
            onClick={() => scrollTo('key-facts')}
            className="btn btn-glass !px-3 !text-xs sm:!px-5 sm:!text-sm"
          >
            <Icon name="filter" className="h-4 w-4" />
            Compare key points
          </button>
        </div>
      </section>

      {/* ---------------- One panel per site ---------------- */}
      <section id="offers" className="shell scroll-mt-28 pt-12">
        <div className="mb-5">
          <h2 className="text-2xl font-extrabold md:text-3xl">
            {offers.length === 1 ? 'One seller stocks this card' : `${offers.length} sellers stock this card`}
          </h2>
          <p className="text-muted mt-1.5 text-sm md:text-base">
            Each seller stocks different denominations — pick a value to see exactly what you pay.
          </p>
        </div>

        <div className="panel-rail">
          {offers.map((offer) => (
            <SitePanel
              key={offer.platformId}
              brand={brand}
              offer={offer}
              isBest={effectiveDiscount(offer) === effectiveDiscount(best)}
              latestCheck={latestCheck}
            />
          ))}
        </div>
      </section>

      {/* ---------------- Side-by-side key facts ---------------- */}
      <section id="key-facts" className="shell scroll-mt-28 pt-14">
        <div className="mb-5">
          <h2 className="text-2xl font-extrabold md:text-3xl">The four points, side by side</h2>
          <p className="text-muted mt-1.5 max-w-2xl text-sm md:text-base">
            Same four questions, same order, one column per site — so you can read straight across
            instead of hunting through fine print.
          </p>
        </div>
        <KeyFactsCompare offers={offers} />

        {/*
          The full fine print, folded away under the four points it expands
          on. Most people only need the table above; the rest is one tap off.
        */}
        <div id="terms" className="mt-4 scroll-mt-28">
          <button
            type="button"
            onClick={() => setTermsOpen((v) => !v)}
            aria-expanded={termsOpen}
            aria-controls="terms-body"
            className="glass flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left"
          >
            <Icon
              name="chevronDown"
              className={`h-4 w-4 shrink-0 transition-transform duration-300 ${termsOpen ? 'rotate-180' : ''}`}
            />
            <span className="flex-1">
              <span className="block text-sm font-bold">Terms &amp; conditions</span>
              <span className="text-faint block text-xs">
                Every seller's full terms, as published on their site
              </span>
            </span>
            <span className="text-faint text-xs font-semibold">
              {termsOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {termsOpen && (
              <motion.div
                id="terms-body"
                key="terms"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.45, 0, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="grid gap-4 pt-4">
                  {offers.map((offer) => (
                    <TermsSection key={offer.platformId} offer={offer} id={termsId(offer.platformId)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
