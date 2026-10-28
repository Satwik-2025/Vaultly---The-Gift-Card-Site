import { PlatformMark } from '../components/PlatformMark';
import { AnimatePresence, motion } from 'framer-motion';
import { TermsList } from './TermsSection';
import { Icon, type IconName } from './Icon';
import { effectiveDiscount, formatPct, getPlatform } from '../services/catalog';
import { KEY_FACT_LABELS, KEY_FACT_ORDER, type FactStatus, type Offer, type PlatformId } from '../types';
import { ink } from '../lib/color';

const STATUS_CLASS: Record<FactStatus, string> = {
  good: 'chip-good',
  limited: 'chip-limited',
  bad: 'chip-bad',
  unknown: 'chip-unknown',
};

const STATUS_DOT: Record<FactStatus, string> = {
  good: '#4ad6a8',
  limited: '#f5b301',
  bad: '#e23744',
  unknown: '#8b93a7',
};

/**
 * The four decision-critical facts, one column per site, aligned row-by-row via
 * CSS subgrid — so "Validity" on GyFTR sits on exactly the same line as
 * "Validity" on Paytm without forcing the content into a table.
 *
 * Each column ends with its own "Terms & conditions" button, which opens that
 * seller's fine print in place. Which ones are open is held by the page, so
 * its shortcut at the top can open them all.
 */
export function KeyFactsCompare({
  offers,
  openTerms,
  onToggleTerms,
}: {
  offers: Offer[];
  openTerms: ReadonlySet<PlatformId>;
  onToggleTerms: (platformId: PlatformId) => void;
}) {
  return (
    <div className="compare-grid no-scrollbar" style={{ ['--cols' as string]: offers.length }}>
      {offers.map((offer, i) => {
        const platform = getPlatform(offer.platformId);
        return (
          <motion.div
            key={offer.platformId}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="compare-col glass glass-sheen overflow-hidden rounded-[var(--radius-xl2)]"
          >
            <header
              className="flex items-center gap-2.5 px-4 py-3.5"
              style={{ background: `linear-gradient(135deg, ${platform.accent}26, transparent)` }}
            >
              <PlatformMark platform={platform} size="sm" />
              <span className="font-display min-w-0 flex-1 truncate text-sm font-bold">
                {platform.name}
              </span>
              <span
                className="shrink-0 text-sm font-extrabold tabular-nums"
                style={{ color: ink(platform.accent) }}
              >
                {effectiveDiscount(offer) > 0 ? `−${formatPct(effectiveDiscount(offer))}%` : '—'}
              </span>
            </header>

            {KEY_FACT_ORDER.map((key, row) => {
              const meta = KEY_FACT_LABELS[key];
              const f = offer.keyFacts[key];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 border-t border-[var(--border)] px-4 py-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                      style={{ background: `${STATUS_DOT[f.status]}1f`, color: ink(STATUS_DOT[f.status], 70) }}
                    >
                      <Icon name={meta.icon as IconName} className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="text-faint text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                      {row + 1}. {meta.label}
                    </span>
                  </div>
                  <span className={`chip ${STATUS_CLASS[f.status]} w-fit !text-[0.72rem]`}>
                    {f.headline}
                  </span>
                  <p className="text-muted text-[0.74rem] leading-relaxed">{f.detail}</p>
                </div>
              );
            })}

            {/* Starts at the top of its row, so opening one column's terms
                doesn't push the other columns' buttons down. */}
            <div className="self-start border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => onToggleTerms(offer.platformId)}
                aria-expanded={openTerms.has(offer.platformId)}
                className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Icon
                  name="chevronDown"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    openTerms.has(offer.platformId) ? 'rotate-180' : ''
                  }`}
                />
                Terms &amp; conditions
              </button>
              <AnimatePresence initial={false}>
                {openTerms.has(offer.platformId) && (
                  <motion.div
                    key="terms"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.45, 0, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <TermsList offer={offer} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
