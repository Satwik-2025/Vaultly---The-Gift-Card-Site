import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { bestDiscount, formatPct, getPlatform, rankedOffers } from '../services/catalog';
import { useSaved } from '../hooks/useApp';
import type { Brand } from '../types';

/**
 * Search-result card. Mirrors the sketch: brand on top, and directly beneath it
 * a short list of every selling site with the maximum discount each is giving,
 * so the comparison is readable before you even open the brand page.
 */
export function BrandCard({ brand, index = 0 }: { brand: Brand; index?: number }) {
  const offers = rankedOffers(brand);
  const top = bestDiscount(brand);
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(brand.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/gift-card/${brand.id}`}
        className="glass glass-sheen card-lift group flex h-full flex-col overflow-hidden rounded-[var(--radius-xl2)]"
      >
        <div
          className="relative px-5 pt-5 pb-4"
          style={{
            background: `linear-gradient(135deg, ${brand.gradient[0]}22, ${brand.gradient[1]}0d)`,
          }}
        >
          <div className="flex items-start gap-3.5">
            <BrandMark brand={brand} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display truncate text-lg font-bold">{brand.name}</h3>
              <p className="text-muted mt-0.5 line-clamp-2 text-xs leading-relaxed">
                {brand.tagline}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              {top > 0 && (
                <span className="chip chip-good !px-2.5 !py-1 !text-[0.7rem]">
                  −{formatPct(top)}%
                </span>
              )}
              {/*
                The whole card is a link, so the bookmark has to stop the click
                from navigating — otherwise saving would also open the brand.
              */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle(brand.id);
                }}
                aria-pressed={saved}
                aria-label={saved ? `Remove ${brand.name} from saved` : `Save ${brand.name}`}
                title={saved ? 'Saved — click to remove' : 'Save this card'}
                className={`grid h-8 w-8 place-items-center rounded-xl border transition-colors ${
                  saved
                    ? 'border-transparent bg-[var(--surface-hover)] text-[var(--text)]'
                    : 'text-muted border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                <Icon
                  name="bookmark"
                  className="h-4 w-4"
                  strokeWidth={saved ? 2.2 : 1.7}
                  fill={saved ? 'currentColor' : 'none'}
                />
              </button>
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-4 pb-4">
          <p className="text-faint px-1 pb-1 text-[0.68rem] font-semibold tracking-[0.14em] uppercase">
            Best on each site
          </p>
          {offers.map((offer) => {
            const platform = getPlatform(offer.platformId);
            const isBest = offer.headlineDiscountPct === top;
            return (
              <div
                key={offer.platformId}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors group-hover:bg-[var(--surface)]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: platform.accent }}
                />
                <span className="flex-1 truncate text-sm font-medium">{platform.name}</span>
                <span
                  className={`text-sm font-bold tabular-nums ${isBest && top > 0 ? '' : 'text-muted'}`}
                  style={isBest && top > 0 ? { color: platform.accent } : undefined}
                >
                  {offer.headlineDiscountPct > 0
                    ? `−${formatPct(offer.headlineDiscountPct)}%`
                    : 'No discount'}
                </span>
              </div>
            );
          })}

          <span className="text-muted mt-auto flex items-center gap-1.5 px-2.5 pt-3 text-xs font-semibold transition-colors group-hover:text-[var(--text)]">
            {offers.length > 1 ? `Compare all ${offers.length} sites` : 'View details & terms'}
            <Icon
              name="arrowRight"
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
            />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
