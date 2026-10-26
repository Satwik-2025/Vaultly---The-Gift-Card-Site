import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { bestDiscount, suggestBrands } from '../services/catalog';

interface SearchBarProps {
  /** `hero` is the big landing input; `compact` sits in the navbar */
  variant?: 'hero' | 'compact';
  initialValue?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({
  variant = 'hero',
  initialValue = '',
  autoFocus = false,
  className = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => (query.trim() ? suggestBrands(query, variant === 'hero' ? 6 : 5) : []),
    [query, variant],
  );

  useEffect(() => setQuery(initialValue), [initialValue]);
  useEffect(() => setCursor(-1), [query]);

  // Close the dropdown when focus or a click lands outside the component.
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const go = (brandId?: string) => {
    setOpen(false);
    inputRef.current?.blur();
    if (brandId) navigate(`/gift-card/${brandId}`);
    else if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    else navigate('/search');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setOpen(true);
      setCursor((c) => {
        const next = e.key === 'ArrowDown' ? c + 1 : c - 1;
        return (next + suggestions.length) % suggestions.length;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(cursor >= 0 ? suggestions[cursor]?.id : undefined);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const hero = variant === 'hero';

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        // No `glass-sheen` here: its top hairline read as a stray line across
        // the search bar rather than as an edge highlight.
        className={`glass flex items-center gap-3 rounded-full transition-colors ${
          hero ? 'px-5 py-3.5 md:px-6 md:py-4' : 'px-4 py-2.5'
        }`}
      >
        <Icon
          name="search"
          className={`shrink-0 text-faint ${hero ? 'h-5 w-5 md:h-[22px] md:w-[22px]' : 'h-[18px] w-[18px]'}`}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          type="search"
          enterKeyHint="search"
          aria-label="Search gift cards by brand"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          placeholder={hero ? 'Search Air India, Myntra, Swiggy…' : 'Search gift cards'}
          className={`field ${hero ? 'text-base md:text-lg' : 'text-sm'}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="text-faint shrink-0 transition-colors hover:text-[var(--text)]"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => go()}
          className={`btn btn-primary shrink-0 ${hero ? '' : 'hidden px-4 py-2 text-xs sm:inline-flex'}`}
        >
          {hero ? (
            <>
              <span className="hidden sm:inline">Compare</span>
              <Icon name="arrowRight" className="h-4 w-4" />
            </>
          ) : (
            'Go'
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            // Never narrower than 18rem: the compact navbar input can be small
            // enough to truncate brand names to three characters.
            className="popover absolute top-[calc(100%+0.6rem)] left-0 z-[60] w-[max(100%,min(18rem,86vw))] overflow-hidden rounded-2xl p-1.5"
          >
            {suggestions.map((brand, i) => (
              <li key={brand.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(brand.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    i === cursor ? 'bg-[var(--surface-hover)]' : ''
                  }`}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${brand.gradient[0]}, ${brand.gradient[1]})`,
                    }}
                  >
                    {brand.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{brand.name}</span>
                    <span className="text-faint block truncate text-xs">{brand.category}</span>
                  </span>
                  <span className="chip chip-good shrink-0">{bestDiscount(brand)}% off</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
