import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrandCard } from '../components/BrandCard';
import { Icon } from '../components/Icon';
import { listCategories, searchBrands } from '../services/catalog';
import type { Category } from '../types';

export function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [category, setCategory] = useState<Category | 'All'>('All');

  const results = useMemo(() => {
    const found = searchBrands(query);
    return category === 'All' ? found : found.filter((b) => b.category === category);
  }, [query, category]);

  const categories = useMemo(() => listCategories(), []);

  return (
    <div className="shell pt-10 pb-8 md:pt-14">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-extrabold md:text-4xl">
          {query ? (
            <>
              Results for <span className="text-gradient">“{query}”</span>
            </>
          ) : (
            'All gift cards'
          )}
        </h1>
        <p className="text-muted mt-2 text-sm md:text-base">
          {results.length} {results.length === 1 ? 'brand' : 'brands'} found · each card shows the
          best discount on every site selling it.
        </p>
      </motion.div>


      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {(['All', ...categories] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`chip shrink-0 !px-3.5 !py-2 transition-all ${
              category === c
                ? // Selected: solid brand fill, not a barely-there tint.
                  'from-brand-500 to-brand-600 !border-transparent bg-gradient-to-br !text-white shadow-lg shadow-[rgb(109_94_252_/_0.35)]'
                : 'hover:!bg-[var(--surface-hover)]'
            }`}
          >
            {category === c ? (
              <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
            ) : (
              c === 'All' && <Icon name="filter" className="h-3.5 w-3.5" />
            )}
            {c}
          </button>
        ))}
      </div>

      {results.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((brand, i) => (
            <BrandCard key={brand.id} brand={brand} index={i} />
          ))}
        </div>
      ) : (
        <div className="glass glass-sheen mt-8 rounded-[var(--radius-xl2)] px-6 py-16 text-center">
          <span className="text-faint mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface)]">
            <Icon name="search" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-xl font-bold">No gift cards matched that</h2>
          <p className="text-muted mx-auto mt-2 max-w-sm text-sm">
            Try a brand name like Myntra or Swiggy, or a category like Travel — or clear the
            category filter above.
          </p>
          <Link to="/search" className="btn btn-primary mt-6">
            Browse all gift cards
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
