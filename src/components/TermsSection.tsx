import { PlatformMark } from '../components/PlatformMark';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { getPlatform } from '../services/catalog';
import { KEY_FACT_LABELS, KEY_FACT_ORDER, type FactStatus, type Offer } from '../types';

const STATUS_CLASS: Record<FactStatus, string> = {
  good: 'chip-good',
  limited: 'chip-limited',
  bad: 'chip-bad',
  unknown: 'chip-unknown',
};

/**
 * Full terms for one site. The four key points are pinned to the top in a fixed
 * order and given real visual weight; everything else is listed below the rule,
 * clearly separated, so the important stuff never gets buried in fine print.
 */
export function TermsSection({ offer, id }: { offer: Offer; id: string }) {
  const platform = getPlatform(offer.platformId);

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="glass glass-sheen scroll-mt-28 overflow-hidden rounded-[var(--radius-xl2)]"
    >
      <header
        className="flex flex-wrap items-center gap-3 px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${platform.accent}24, transparent 70%)` }}
      >
        <PlatformMark platform={platform} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold">
            {platform.name}
            <span className="text-muted font-sans text-sm font-medium"> · terms &amp; conditions</span>
          </h3>
          <p className="text-faint text-[0.7rem]">
            Read from {platform.name} on{' '}
            {new Date(offer.lastChecked).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <a
          href={offer.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-glass !px-3 !py-1.5 !text-xs"
        >
          Source
          <Icon name="external" className="h-3.5 w-3.5" />
        </a>
      </header>

      {/* ---- The four points that decide the purchase ---- */}
      <div className="grid gap-2.5 px-5 py-4 sm:grid-cols-2">
        {KEY_FACT_ORDER.map((key, i) => {
          const meta = KEY_FACT_LABELS[key];
          const f = offer.keyFacts[key];
          return (
            <div
              key={key}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ background: `${platform.accent}1f`, color: platform.accent }}
                >
                  <Icon name={meta.icon as IconName} className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-faint text-[0.6rem] font-bold tracking-[0.14em] uppercase">
                    Key point {i + 1}
                  </p>
                  <p className="text-[0.82rem] font-semibold">{meta.question}</p>
                </div>
              </div>
              <span className={`chip ${STATUS_CLASS[f.status]} mt-2.5 !text-[0.72rem]`}>
                {f.headline}
              </span>
              <p className="text-muted mt-2 text-[0.78rem] leading-relaxed">{f.detail}</p>
              {f.source && (
                <blockquote
                  className="text-faint mt-2 border-l-2 pl-2.5 text-[0.72rem] leading-relaxed italic"
                  style={{ borderColor: `${platform.accent}66` }}
                >
                  “{f.source}”
                </blockquote>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Everything else ---- */}
      <div className="border-t border-[var(--border)] px-5 py-4">
        <p className="text-faint mb-2.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase">
          Other terms
        </p>
        <ul className="space-y-2">
          {offer.otherTerms.map((term) => (
            <li key={term} className="text-muted flex gap-2.5 text-[0.82rem] leading-relaxed">
              <span
                aria-hidden
                className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full"
                style={{ background: platform.accent }}
              />
              {term}
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}
