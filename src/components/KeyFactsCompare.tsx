import { PlatformMark } from '../components/PlatformMark';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { effectiveDiscount, formatPct, getPlatform } from '../services/catalog';
import { KEY_FACT_LABELS, KEY_FACT_ORDER, type FactStatus, type Offer } from '../types';
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
 */
export function KeyFactsCompare({ offers }: { offers: Offer[] }) {
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
          </motion.div>
        );
      })}
    </div>
  );
}
