import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { discoverNewCards, type DiscoveryResult } from '../services/catalog';

/**
 * On load, syncs which gift cards the sellers still list — adding new arrivals
 * and dropping ones they've pulled. Silent when nothing changed (the common
 * case) and when the site is served statically with no live endpoint.
 *
 * Removals matter as much as additions here: a delisted card that stays in the
 * catalog sends you to a page you can't buy from, which is worse than not
 * listing it at all.
 */
export function NewCardsBanner({ onCatalogUpdated }: { onCatalogUpdated: () => void }) {
  const [found, setFound] = useState<DiscoveryResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    discoverNewCards().then((result) => {
      if (!live || (result.added === 0 && result.removed === 0)) return;
      setFound(result);
      onCatalogUpdated();
    });
    return () => {
      live = false;
    };
  }, [onCatalogUpdated]);

  const show = found !== null && (found.added > 0 || found.removed > 0) && !dismissed;

  const list = (names: string[]) => {
    const head = names.slice(0, 2).join(', ');
    const rest = names.length - 2;
    return rest > 0 ? `${head} and ${rest} more` : head;
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md md:inset-x-auto md:right-5 md:bottom-5"
        >
          <div className="popover flex items-start gap-3 rounded-2xl p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ok)]/15 text-[var(--ok)]">
              <Icon name="refresh" className="h-4 w-4" strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-bold">Catalog updated</p>

              {found.added > 0 && (
                <p className="text-muted text-xs leading-relaxed">
                  <span className="font-bold text-[var(--ok)]">
                    +{found.added} newly listed
                  </span>{' '}
                  · {list(found.brands.map((b) => b.name))}
                </p>
              )}

              {found.removed > 0 && (
                <p className="text-muted text-xs leading-relaxed">
                  <span className="font-bold text-[var(--bad)]">
                    −{found.removed} no longer sold
                  </span>{' '}
                  · {list(found.removedBrands.map((b) => b.name))}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="text-faint shrink-0 transition-colors hover:text-[var(--text)]"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
