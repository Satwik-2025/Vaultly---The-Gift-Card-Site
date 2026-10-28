import { PlatformMark } from '../components/PlatformMark';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { formatINR, formatPct, getPlatform, payable, savings } from '../services/catalog';
import type { Brand, Denomination, Offer } from '../types';
import { ink } from '../lib/color';

/** Stable identity for a denomination. Amount alone is not unique. */
const denomKey = (d: Denomination): string => `${d.value}|${d.label ?? ''}`;

/** "4 min ago", "3 hr ago", "2 d ago" — short enough to sit under a button. */
function ageLabel(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (!Number.isFinite(mins)) return 'unknown';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

interface SitePanelProps {
  brand: Brand;
  offer: Offer;
  /** True when no other site beats this one */
  isBest: boolean;
  /** Smooth-scrolls to this site's terms section */
  onJumpToTerms: () => void;
  /**
   * The newest reading across all sellers on this page. An offer older than
   * that is one the last re-check couldn't refresh.
   */
  latestCheck: string;
}

/**
 * One selling site's whole story: its denominations, the real payable price,
 * a link out to the seller, and a jump into its own terms block further down.
 */
export function SitePanel({ brand, offer, isBest, onJumpToTerms, latestCheck }: SitePanelProps) {
  const platform = getPlatform(offer.platformId);
  const custom = offer.customAmount;

  // Fixed-slab cards default to the middle slab, which is what people buy most.
  const defaultDenom = offer.denominations.length
    ? offer.denominations[Math.floor((offer.denominations.length - 1) / 2)]
    : null;

  // Identity must include the label: four Zee5 packs all cost ₹699, so keying
  // selection on the amount alone highlighted all four and always resolved back
  // to whichever one happened to be first in the list.
  const [selected, setSelected] = useState<string | null>(
    defaultDenom ? denomKey(defaultDenom) : null,
  );
  const [customInput, setCustomInput] = useState<string>(custom ? String(custom.min) : '');

  const hasFixed = offer.denominations.length > 0;
  /**
   * A seller can offer both at once: Woohoo's AJIO card is open-value at 7%,
   * while a separate ₹100 pack runs at 25%. Showing only one of them meant the
   * panel advertised "up to 25%" over a field that could only ever give 7%.
   */
  const [mode, setMode] = useState<'custom' | 'fixed'>(custom ? 'custom' : 'fixed');
  const usingCustom = Boolean(custom) && mode === 'custom';

  const typedAmount = Number(customInput.replace(/[^\d]/g, ''));
  const hasTyped = customInput.trim() !== '';

  // Validate the typed amount against the seller's own published bounds.
  const customError = !custom
    ? null
    : !hasTyped
      ? 'Enter an amount'
      : !Number.isFinite(typedAmount) || typedAmount <= 0
        ? 'Enter a valid amount'
        : typedAmount < custom.min
          ? `Minimum is ${formatINR(custom.min)} — ${formatINR(custom.min - typedAmount)} more needed`
          : typedAmount > custom.max
            ? `Maximum is ${formatINR(custom.max)} — ${formatINR(typedAmount - custom.max)} over the limit`
            : null;

  const denom = usingCustom
    ? {
        value: typedAmount,
        discountPct: custom!.discountPct,
        bonusPct: custom!.bonusPct,
        label: null,
      }
    : (offer.denominations.find((d) => denomKey(d) === selected) ?? defaultDenom);

  const amount = denom?.value ?? 0;
  const discountPct = denom?.discountPct ?? 0;
  const pay = payable(amount, discountPct);
  const save = savings(amount, discountPct);

  /*
    "Get 8% Extra" works the other way round from a discount: the amount is
    what you pay, and the card comes out bigger. Shown the way Woohoo sells it,
    with the equivalent discount alongside so it still compares with the rest.
  */
  const bonusPct = denom?.bonusPct ?? 0;
  const bonusValue = Math.round((amount * bonusPct) / 100);
  const cardWithBonus = amount + bonusValue;

  /*
    How old this seller's number is, and whether the last re-check actually
    managed to refresh it.

    Sellers fail independently: Amazon rate-limits, a page times out, a sitemap
    is briefly unreachable. When that happens the panel keeps its previous
    numbers — which is right, but showing them with no marker implies they were
    just confirmed. So every panel states its own age, and one that missed the
    last sweep says so and points at the seller for the live price.
  */
  const checkedMs = new Date(offer.lastChecked).getTime();
  const checkedAgo = ageLabel(checkedMs);
  // A minute of slack: sellers in one sweep finish seconds apart.
  const missedLastCheck = new Date(latestCheck).getTime() - checkedMs > 60_000;

  // The best payment-method discount, which can beat the card discount outright.
  const bestPaymentPct = offer.paymentOffers.reduce((n, p) => Math.max(n, p.discountPct), 0);
  // "Discount on UPI Payments" -> "UPI Payments", which is all that fits here.
  const bestPaymentMethod = (offer.paymentOffers.find((p) => p.discountPct === bestPaymentPct)?.name ?? '')
    .replace(/^Discount\s+(on|with)\s+/i, '')
    .trim();

  const canBuy = offer.inStock && (usingCustom ? !customError : Boolean(denom));

  /**
   * Where "buy" should land.
   *
   * A merged offer spans several listings — Woohoo sells each Zee5 pack on its
   * own page, Amazon lists one brand under several ASINs — so send the shopper
   * to the page for the exact pack they picked rather than a generic landing
   * page. Falls back to the offer's main URL when there's nothing more specific.
   */
  const buyUrl =
    // The slab's own listing wins: matching on label alone sent every PhonePe
    // slab to the first source, because both of Woohoo's listings have no label.
    denom?.sourceUrl ||
    (denom?.label && offer.sources?.find((s) => s.label === denom.label)?.url) ||
    // A typed amount belongs to the open-value listing, not to whichever
    // listing happened to supply the headline.
    (usingCustom && offer.customAmount?.sourceUrl) ||
    offer.productUrl;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      aria-label={`${platform.name} offers for ${brand.name}`}
      className="glass glass-sheen relative flex flex-col overflow-hidden rounded-[var(--radius-xl2)]"
      style={{ boxShadow: `var(--shadow-glass), inset 0 0 0 1px ${platform.accent}1a` }}
    >
      {/* Accent wash keyed to the platform so panels are distinguishable at a glance */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-45"
        style={{
          background: `radial-gradient(120% 100% at 50% 0%, ${platform.accent}59, transparent 70%)`,
        }}
      />

      <header className="relative px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <PlatformMark platform={platform} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display truncate text-base font-bold">{platform.name}</h3>
              {isBest && (
                <span className="chip chip-good !px-2 !py-0.5 !text-[0.62rem]">
                  <Icon name="spark" className="h-3 w-3" strokeWidth={2} />
                  Best price
                </span>
              )}
            </div>
            <p className="text-faint mt-0.5 line-clamp-1 text-[0.7rem]">{platform.tagline}</p>
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-faint text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
              {offer.bonusPct
                ? 'Get'
                : offer.headlineDiscountPct > 0 || bestPaymentPct === 0
                  ? 'Up to'
                  : 'Best price with'}
            </p>
            <p
              className="font-display text-3xl leading-none font-extrabold"
              style={{ color: ink(platform.accent) }}
            >
              {offer.bonusPct ? (
                <>
                  {formatPct(offer.bonusPct)}%
                  <span className="text-muted ml-1 text-sm font-bold">extra</span>
                  <span className="chip ml-2 !px-2 !py-0.5 align-middle !text-[0.62rem] font-bold">
                    ≈ {formatPct(offer.headlineDiscountPct)}% off overall
                  </span>
                </>
              ) : offer.headlineDiscountPct > 0 ? (
                <>
                  {formatPct(offer.headlineDiscountPct)}%
                  <span className="text-muted ml-1 text-sm font-bold">off</span>
                </>
              ) : bestPaymentPct > 0 ? (
                /*
                  The card itself is sold at face value, but a payment offer
                  gets you a real discount — Woohoo's Air India card is 0% on
                  paper and 6% paying by UPI. Saying "Face value" here was the
                  headline that made the panel look like a dead end.
                */
                <>
                  {formatPct(bestPaymentPct)}%
                  <span className="text-muted ml-1 text-sm font-bold">
                    off · {bestPaymentMethod}
                  </span>
                </>
              ) : (
                <span className="text-muted text-xl">Face value</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="chip !text-[0.68rem]">
              <Icon name="shield" className="h-3.5 w-3.5" />
              {offer.deliveryEta}
            </span>
            {(offer.listingCount ?? 1) > 1 && (
              <span className="text-faint text-[0.62rem]">
                {offer.listingCount} listings merged
              </span>
            )}
          </div>
        </div>

        {offer.bonusPct ? (
          <p className="text-muted mt-3 text-[0.72rem] leading-relaxed">
            {platform.name} doesn’t cut the price, it adds value: pay {formatINR(1000)}, get a{' '}
            {formatINR(1000 + offer.bonusPct * 10)} card. That works out to about{' '}
            {formatPct(offer.headlineDiscountPct)}% off.
          </p>
        ) : null}
      </header>

      {/* ---- Denominations ---- */}
      <div className="relative px-5 pb-4">
        <p className="text-faint mb-2 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
          {custom
            ? custom.bonusPct
              ? 'Enter the amount you pay'
              : 'Enter any amount'
            : `Available denominations (${offer.denominations.length})`}
        </p>

        {custom && (
          <div
            onFocusCapture={() => setMode('custom')}
            onPointerDownCapture={() => setMode('custom')}
            className={`rounded-xl transition-opacity ${usingCustom ? '' : 'opacity-60'}`}
          >
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors"
              style={{
                borderColor: customError && hasTyped ? '#e23744' : platform.accent,
                background: 'var(--surface)',
              }}
            >
              <span className="text-muted text-lg font-bold">₹</span>
              <input
                type="text"
                inputMode="numeric"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value.replace(/[^\d]/g, ''))}
                aria-label={`Gift card amount for ${platform.name}, between ${custom.min} and ${custom.max} rupees`}
                aria-invalid={Boolean(customError)}
                placeholder={String(custom.min)}
                className="field text-lg font-bold tabular-nums"
              />
              <span className="text-faint shrink-0 text-[0.68rem] font-semibold">
                {formatINR(custom.min)}–{formatINR(custom.max)}
              </span>
            </div>

            <p
              className={`mt-1.5 text-[0.7rem] font-semibold ${
                customError && hasTyped ? 'text-[var(--bad)]' : 'text-faint'
              }`}
            >
              {hasTyped && customError
                ? customError
                : `Any amount between ${formatINR(custom.min)} and ${formatINR(custom.max)}`}
            </p>

            {/* Quick picks so the common amounts are still one tap away */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[custom.min, 500, 1000, 2000, 5000, custom.max]
                .filter((v, i, arr) => v >= custom.min && v <= custom.max && arr.indexOf(v) === i)
                .map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCustomInput(String(v))}
                    className="chip !px-2.5 !py-1 !text-[0.68rem] transition-colors hover:!bg-[var(--surface-hover)]"
                  >
                    {formatINR(v)}
                  </button>
                ))}
            </div>
          </div>
        )}

        {hasFixed && (
          <>
            {custom && (
              <p className="text-faint mt-4 mb-2 text-[0.65rem] font-semibold tracking-[0.14em] uppercase">
                Or a fixed pack
              </p>
            )}
            {/* Named subscription packs need room to read; bare amounts don't. */}
            <div
              className={`grid gap-2 transition-opacity ${usingCustom ? 'opacity-60' : ''} ${
                offer.denominations.some((d) => d.label)
                  ? 'grid-cols-1 min-[360px]:grid-cols-2'
                  : 'grid-cols-3'
              }`}
            >
              {offer.denominations.map((d) => {
                const key = denomKey(d);
                const active = !usingCustom && key === selected;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelected(key);
                      setMode('fixed');
                    }}
                    aria-pressed={active}
                    title={d.label ?? undefined}
                    className="relative rounded-xl border px-2 py-2.5 text-center transition-all duration-200"
                    style={{
                      borderColor: active ? platform.accent : 'var(--border)',
                      background: active ? `${platform.accent}1f` : 'var(--surface)',
                    }}
                  >
                    <span className="block text-sm font-bold tabular-nums">
                      {formatINR(d.value)}
                    </span>
                    {d.label ? (
                      <span className="text-faint mt-0.5 block line-clamp-2 text-[0.6rem] leading-tight font-semibold">
                        {d.label}
                      </span>
                    ) : (
                      <span
                        className="text-muted block text-[0.68rem] font-semibold tabular-nums"
                        style={active ? { color: ink(platform.accent) } : undefined}
                      >
                        {d.bonusPct
                          ? `+${formatPct(d.bonusPct)}% extra`
                          : d.discountPct > 0
                            ? `−${formatPct(d.discountPct)}%`
                            : '—'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/*
          Shown from the first offer, not the second. Woohoo's Air India card
          carries no card discount at all yet pays 6% on UPI and 5% on debit —
          hiding a lone payment offer reported that card as "no discount", which
          is the opposite of true. Highlighted when it's the only saving going.
        */}
        {offer.paymentOffers.length > 0 && (
          <div
            className="mt-3 rounded-xl border p-2.5"
            style={
              bestPaymentPct > offer.headlineDiscountPct
                ? { borderColor: `${platform.accent}66`, background: `${platform.accent}14` }
                : { borderColor: 'var(--border)', background: 'var(--surface)' }
            }
          >
            <p className="text-faint text-[0.6rem] font-bold tracking-[0.14em] uppercase">
              {bestPaymentPct > offer.headlineDiscountPct
                ? `Up to ${formatPct(bestPaymentPct)}% off by payment method`
                : 'Discount by payment method'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {offer.paymentOffers.map((p) => (
                <span key={p.name} className="chip !px-2 !py-0.5 !text-[0.62rem]">
                  {p.name} · {formatPct(p.discountPct)}%
                  {/* The code is the whole mechanism — without it there's no discount. */}
                  {p.code ? <span className="ml-1 opacity-70">code {p.code}</span> : null}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Price breakdown, exactly as sketched: face → discount → you pay ---- */}
      <div className="relative mx-5 mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {bonusPct > 0 ? (
          <>
            <div className="text-muted flex items-center justify-between text-sm">
              <span>You pay</span>
              <span className="tabular-nums">{formatINR(amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-muted">
                {platform.name} adds {formatPct(bonusPct)}% extra
              </span>
              <span className="font-semibold tabular-nums text-[var(--ok)]">
                +{formatINR(bonusValue)}
              </span>
            </div>
            <div className="my-3 h-px bg-[var(--border)]" />
            <div className="flex items-end justify-between">
              <span className="text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                Card you get
              </span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={cardWithBonus}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="font-display text-2xl leading-none font-extrabold tabular-nums"
                >
                  {formatINR(cardWithBonus)}
                </motion.span>
              </AnimatePresence>
            </div>
            <p className="text-faint mt-2 text-right text-[0.68rem]">
              Same as ≈ {formatPct(discountPct)}% off a {formatINR(cardWithBonus)} card
            </p>
          </>
        ) : (
          <>
            <div className="text-muted flex items-center justify-between text-sm">
              <span>Card value</span>
              <span className="tabular-nums">{formatINR(amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-muted">Discount ({formatPct(discountPct)}%)</span>
              <span className="font-semibold tabular-nums text-[var(--ok)]">−{formatINR(save)}</span>
            </div>
            <div className="my-3 h-px bg-[var(--border)]" />
            <div className="flex items-end justify-between">
              <span className="text-[0.7rem] font-semibold tracking-[0.14em] uppercase">You pay</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={pay}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="font-display text-2xl leading-none font-extrabold tabular-nums"
                >
                  {formatINR(pay)}
                </motion.span>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* ---- Actions ---- */}
      <div className="relative mt-auto flex flex-col gap-2 px-5 pb-5">
        {/* Buying happens on the seller's own site — this hands the shopper
            straight to the exact listing they were comparing. */}
        <a
          href={buyUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!canBuy}
          onClick={(e) => {
            if (!canBuy) e.preventDefault();
          }}
          className={`btn btn-primary w-full ${canBuy ? '' : 'pointer-events-none opacity-45'}`}
          style={
            offer.inStock
              ? {
                  background: `linear-gradient(180deg, rgb(255 255 255 / 0.22), rgb(255 255 255 / 0) 60%), linear-gradient(135deg, ${platform.accent}, ${platform.accent}cc)`,
                  boxShadow: `0 10px 30px -10px ${platform.accent}bf, inset 0 1px 0 rgb(255 255 255 / 0.28)`,
                }
              : undefined
          }
        >
          <Icon name="external" className="h-4 w-4" />
          {!offer.inStock
            ? 'Out of stock'
            : usingCustom && customError
              ? customError.split('—')[0].trim()
              : denom?.label
                ? `Buy ${denom.label} on ${platform.name}`
                : bonusPct > 0
                  ? `Pay ${formatINR(amount)}, get ${formatINR(cardWithBonus)} on ${platform.name}`
                  : `Buy ${formatINR(amount)} card on ${platform.name}`}
        </a>

        {missedLastCheck ? (
          <p className="stack-warning flex items-start gap-2 rounded-xl border px-3 py-2 text-[0.7rem] leading-relaxed">
            <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {/* Worded to be true both when a seller failed and when it's
                  deliberately left to the daily scrape (Amazon on the
                  deployed site) — "couldn't" would imply something broke. */}
              <span className="font-bold">Price from {checkedAgo}.</span> This check didn't
              re-read {platform.name} — open the button above for their live price.
            </span>
          </p>
        ) : (
          <p className="text-faint flex items-center justify-center gap-1.5 text-[0.7rem]">
            <Icon name="check" className="h-3.5 w-3.5" />
            {platform.name} price checked {checkedAgo}
          </p>
        )}

        <button type="button" onClick={onJumpToTerms} className="btn btn-glass w-full !text-xs">
          <Icon name="chevronDown" className="h-3.5 w-3.5" />
          Terms &amp; conditions
        </button>
      </div>
    </motion.section>
  );
}
