import { PlatformMark } from '../components/PlatformMark';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSearchDock } from '../hooks/useApp';
import { SEARCH_DOCK_TRANSITION, SEARCH_LAYOUT_ID } from '../context/SearchDock';
import { SearchBar } from '../components/SearchBar';
import { BrandCard } from '../components/BrandCard';
import { Icon, type IconName } from '../components/Icon';
import { listBrands, listPlatforms, searchBrands } from '../services/catalog';
import { KEY_FACT_LABELS, KEY_FACT_ORDER } from '../types';

const POPULAR = ['Domino’s', 'HealthKart', 'Myntra', 'Swiggy', 'Air India', 'Nykaa'];

export function Home() {
  const { docked, setDocked, canDock } = useSearchDock();
  const heroSlotRef = useRef<HTMLDivElement>(null);

  /**
   * The hero holds the search bar until its slot slides under the sticky
   * navbar; at that point it hands it over and Framer flies it into place.
   * Watching the slot's real position beats a guessed scroll offset.
   */
  useEffect(() => {
    if (!canDock) {
      setDocked(false);
      return;
    }
    const el = heroSlotRef.current;
    if (!el) return;

    // Hand over the moment the bar *reaches* the navbar, not once it has already
    // slid past it. Offsetting the root by the navbar height plus the slot's own
    // height makes the observer fire on the slot's top edge rather than its
    // bottom, so the bar appears to fly straight up into the bar.
    const NAVBAR_BOTTOM = 72;
    const slotHeight = Math.round(el.getBoundingClientRect().height);

    const io = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting), {
      rootMargin: `-${NAVBAR_BOTTOM + slotHeight}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(el);

    return () => {
      io.disconnect();
      // Leaving Home: every other page wants it docked.
      setDocked(true);
    };
  }, [canDock, setDocked]);

  // Lead with brands that actually have something to compare.
  const multiSeller = listBrands().filter((b) => b.offers.length > 1);
  const trending = (multiSeller.length >= 6 ? multiSeller : listBrands())
    .slice()
    .sort((a, b) => b.offers.length - a.offers.length)
    .slice(0, 60);
  const featured = searchBrands('')
    .filter((b) => trending.includes(b))
    .slice(0, 6);
  const totalOffers = listBrands().reduce((n, b) => n + b.offers.length, 0);
  const platforms = listPlatforms();

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="shell pt-14 pb-16 md:pt-24 md:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="chip mx-auto !px-3.5 !py-1.5"
          >
            <Icon name="spark" className="h-3.5 w-3.5 text-[#4ad6a8]" strokeWidth={2} />
            {listBrands().length} brands · {totalOffers} live offers · {platforms.length} sellers
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="mt-5 text-4xl leading-[1.05] font-extrabold sm:text-5xl md:text-6xl"
          >
            Never overpay for a<br />
            <span className="text-gradient">gift card</span> again.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="text-muted mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg"
          >
            One search compares every marketplace selling the card you want — and shows the four
            terms that decide whether the discount is actually worth it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-8"
          >
            {/* Reserves the bar's height so the page doesn't jump when it
                docks into the navbar. */}
            <div ref={heroSlotRef} className="mx-auto min-h-[3.9rem] max-w-2xl md:min-h-[4.25rem]">
              {!docked && (
                <motion.div layoutId={SEARCH_LAYOUT_ID} transition={SEARCH_DOCK_TRANSITION}>
                  <SearchBar />
                </motion.div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-faint text-xs">Popular:</span>
              {POPULAR.map((term) => (
                <Link
                  key={term}
                  to={`/search?q=${encodeURIComponent(term)}`}
                  className="chip transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                >
                  {term}
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- The four points ---------------- */}
      <section className="shell pb-16 md:pb-24">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">The four things nobody tells you</h2>
            <p className="text-muted mt-1.5 max-w-xl text-sm md:text-base">
              A 20% discount is worthless if the card expires in three months or forfeits your
              leftover balance. We surface these on every single listing.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KEY_FACT_ORDER.map((key, i) => {
            const meta = KEY_FACT_LABELS[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="glass glass-sheen card-lift rounded-[var(--radius-xl2)] p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="from-brand-500/25 to-mint-500/20 text-brand-300 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br">
                    <Icon name={meta.icon as IconName} className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="font-display text-faint text-3xl font-extrabold">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold">{meta.label}</h3>
                <p className="text-muted mt-1.5 text-sm leading-relaxed">{meta.question}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ---------------- Sites we compare ---------------- */}
      <section className="shell pb-16 md:pb-24">
        <div className="glass glass-sheen rounded-[var(--radius-xl2)] p-6 md:p-8">
          <h2 className="text-center text-sm font-bold tracking-[0.16em] uppercase">
            <span className="text-faint">Comparing prices across</span>
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {platforms.map((p) => {
              return (
                <a
                  key={p.id}
                  href={p.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-lift flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5"
                >
                  {/* Wider than tall: this row is the one place the logo is the
                      primary identifier, so wordmarks get room to be read. */}
                  <PlatformMark platform={p} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{p.name}</span>
                    <span className="text-faint block truncate text-[0.68rem]">Live offers</span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Trending ---------------- */}
      <section className="shell pb-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">Best worth comparing</h2>
            <p className="text-muted mt-1.5 text-sm md:text-base">
              Sold by more than one seller, ranked by the biggest discount available.
            </p>
          </div>
          <Link to="/search" className="btn btn-glass">
            View all
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((brand, i) => (
            <BrandCard key={brand.id} brand={brand} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
