import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { formatPct } from '../services/catalog';
import type { CashKaro } from '../types';

/**
 * Cashback on top of the gift card discount.
 *
 * Deliberately not a fourth seller panel: CashKaro doesn't sell the card, it
 * pays you for clicking through to the brand's own site. Putting its rate in
 * the same row as GyFTR's discount would read as "a fourth place to buy this",
 * which it isn't.
 */

const PLATFORM_LABEL: Record<CashKaro['platforms'], string> = {
  both: 'App + website',
  website: 'Website only',
  app: 'App only',
  unknown: 'Not stated',
};

/* Reuses the key-fact chip palette, which already has a light-theme variant —
   raw mint and amber are unreadable on a near-white surface. */
const PLATFORM_TONE: Record<CashKaro['platforms'], string> = {
  both: 'chip-good',
  website: 'chip-limited',
  app: 'chip-limited',
  unknown: 'chip-unknown',
};

const formatRate = (r: { type: 'percent' | 'flat'; amount: number }) =>
  r.type === 'percent' ? `${formatPct(r.amount)}%` : `₹${r.amount.toLocaleString('en-IN')}`;

export function CashKaroCard({ cashKaro, brandName }: { cashKaro: CashKaro; brandName: string }) {
  const { active, rate } = cashKaro;
  const [showRates, setShowRates] = useState(false);

  // Every rate, always on screen. CashKaro itself hides all but the headline
  // behind "View Cashback Rates", which is how Air India's ₹80 on domestic
  // flights goes unnoticed next to the ₹275 on international — and the
  // headline alone is the one that misleads.
  const otherRates = (cashKaro.rates ?? []).slice(1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      aria-label={`CashKaro cashback on ${brandName}`}
      className="glass glass-sheen relative mt-4 overflow-hidden rounded-[var(--radius-xl2)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(80% 120% at 6% 0%, #7a3cff40, transparent 62%)' }}
      />

      <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-11 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-white/90 px-2">
            <img
              src={`${import.meta.env.BASE_URL}logos/cashkaro.png`}
              alt="CashKaro"
              className="h-6 max-w-[5.5rem] object-contain"
              loading="lazy"
            />
          </span>

          <div className="min-w-0">
            <p className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
              Cashback on top
            </p>

            {active && rate ? (
              <>
                {/*
                  "Up to", because the top rate only ever covers one slice of
                  the catalogue. Naming that slice here ("7% on Apparel") reads
                  as the headline promise and buries the other 21 rates, so the
                  category detail lives in the full table instead.
                */}
                <p className="font-display mt-1 text-2xl font-extrabold">
                  Up to{' '}
                  {rate.type === 'percent'
                    ? `${formatPct(rate.amount)}% cashback`
                    : `₹${rate.amount.toLocaleString('en-IN')} cashback`}
                  {rate.wasAmount !== null && (
                    <span className="text-faint ml-2 align-middle text-sm font-semibold line-through">
                      {rate.type === 'percent' ? `${formatPct(rate.wasAmount)}%` : `₹${rate.wasAmount}`}
                    </span>
                  )}
                </p>
                <p className="text-muted mt-1 text-sm">
                  Rate depends on what you buy.
                </p>
              </>
            ) : (
              <p className="font-display mt-1 text-xl font-extrabold">
                No cashback on {brandName} right now
                <span className="text-muted ml-1.5 font-sans text-sm font-semibold">
                  · listed, but paying nothing
                </span>
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {active && (
                <span
                  className={`chip !gap-1.5 !text-[0.68rem] !font-bold ${PLATFORM_TONE[cashKaro.platforms]}`}
                  title={cashKaro.platformNote ?? undefined}
                >
                  <Icon name="shield" className="h-3.5 w-3.5" />
                  {PLATFORM_LABEL[cashKaro.platforms]}
                </span>
              )}
              {cashKaro.trackingSpeed && active && (
                <span className="text-faint inline-flex items-center gap-1.5 text-[0.68rem] font-semibold">
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  Tracks in {cashKaro.trackingSpeed}
                </span>
              )}
            </div>

            {/* CashKaro's own sentence, so the badge above can be checked. */}
            {active && cashKaro.platformNote && (
              <p className="text-faint mt-2 max-w-md text-xs leading-relaxed italic">
                “{cashKaro.platformNote}”
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto">
          {/* Full-size button, not a text link: the rate you actually get is
              usually one of the rows behind it, so it has to look worth a tap. */}
          {cashKaro.rates.length > 1 && (
            <button
              type="button"
              onClick={() => setShowRates((open) => !open)}
              aria-expanded={showRates}
              className="btn btn-primary w-full md:w-auto"
            >
              <Icon
                name="chevronDown"
                className={`h-4 w-4 transition-transform ${showRates ? 'rotate-180' : ''}`}
              />
              {showRates ? 'Hide rates' : `See all ${cashKaro.rates.length} rates`}
            </button>
          )}

          <a
            href={cashKaro.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-glass w-full md:w-auto"
          >
            <Icon name="external" className="h-4 w-4" />
            Open on CashKaro
          </a>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showRates && otherRates.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden border-t border-[var(--border)]"
          >
            <div className="px-5 pt-3 pb-1 md:px-6">
              <p className="text-faint text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Every published rate ({cashKaro.rates.length})
              </p>
              <ul className="mt-1 divide-y divide-[var(--border)]">
                {cashKaro.rates.map((r, i) => (
                  <li key={`${r.amount}-${i}`} className="flex items-start gap-3 py-2.5">
                    <span
                      className="font-display w-16 shrink-0 text-sm font-extrabold tabular-nums"
                      /* A 0% row is a real answer — "this category earns
                         nothing" — so it's shown, just not dressed up. */
                      style={r.amount === 0 ? { color: 'var(--muted)' } : undefined}
                    >
                      {formatRate(r)}
                    </span>
                    <span className="text-muted text-xs leading-relaxed">{r.details}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        The one line that decides whether cashback and a gift card actually
        stack. Myntra, Nykaa, AJIO and Croma all exclude gift-voucher payments
        from the order value they pay on — so on those brands you pick one
        saving, not both. Shown loudly because the rest of this page is about
        buying the card.
      */}
      {active && cashKaro.giftCardCaveat && (
        <div className="stack-warning relative border-t px-5 py-3.5 md:px-6">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed">
            <Icon name="merge" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-bold">Won't stack with a gift card.</span>{' '}
              <span className="opacity-90">{cashKaro.giftCardCaveat}</span>
            </span>
          </p>
        </div>
      )}
    </motion.section>
  );
}
