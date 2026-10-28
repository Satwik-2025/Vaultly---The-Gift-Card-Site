import { Icon } from './Icon';
import { getPlatform } from '../services/catalog';
import type { Offer } from '../types';

/**
 * One seller's terms and conditions, as a plain list.
 *
 * Shown inside that seller's column of the key-points comparison, under its
 * own button. The four key points are already answered right above it, so
 * this is only the fine print — not a second copy of the comparison.
 */
export function TermsList({ offer }: { offer: Offer }) {
  const platform = getPlatform(offer.platformId);
  const read = new Date(offer.lastChecked).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="px-4 pb-4">
      {offer.otherTerms.length ? (
        <ul className="space-y-2">
          {offer.otherTerms.map((term) => (
            <li key={term} className="text-muted flex gap-2.5 text-[0.76rem] leading-relaxed">
              <span
                aria-hidden
                className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full"
                style={{ background: platform.accent }}
              />
              {term}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-[0.76rem]">{platform.name} doesn’t publish terms for this card.</p>
      )}

      <p className="text-faint mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem]">
        Read from {platform.name} on {read}.
        <a
          href={offer.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[var(--text)] hover:underline"
        >
          See on {platform.name}
          <Icon name="external" className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
