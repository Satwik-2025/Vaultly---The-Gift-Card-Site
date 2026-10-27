import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { SearchBar } from './SearchBar';
import { useSearchDock } from '../hooks/useApp';
import { ThemeMenu } from './ThemeMenu';
import { ProfileMenu } from './ProfileMenu';
import { Logo } from './Logo';
import { SEARCH_DOCK_TRANSITION, SEARCH_LAYOUT_ID } from '../context/SearchDock';

export function Navbar() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const { docked } = useSearchDock();
  /**
   * Phone-sized screens can't fit an inline search box: after the logo, theme,
   * theme and profile there is barely 100px left, and the suggestions dropdown
   * inherits that width. Below `sm` the bar becomes a sheet instead.
   */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Any navigation (including picking a suggestion) closes the sheet.
  useEffect(() => setMobileSearchOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileSearchOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileSearchOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-[padding] duration-300 ${scrolled ? 'pt-2' : 'pt-3 md:pt-5'}`}
    >
      <div className="shell">
        <nav
          className={`glass glass-sheen flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 md:gap-4 md:px-4 ${
            scrolled ? 'shadow-2xl' : ''
          }`}
        >
          {/* `flex` rather than the default inline box: an inline link
              reserves room for text descenders under its content, which sat
              the mark 3px above the bar's centre. */}
          <Link
            to="/"
            className="flex shrink-0 items-center pl-2 md:pl-3"
            aria-label="Vaultly home"
          >
            {/* With the theme button gone on phones there's room for the
                wordmark there too, one step smaller. */}
            <Logo
              showTagline
              className="text-[26px] sm:text-[30px]"
              markClassName="h-[44px] w-[44px]"
            />
          </Link>

          {/* The search bar lives here only once docked. While the hero owns it,
              this slot stays empty and the bar flies in via its shared layoutId. */}
          <div className="hidden min-w-0 flex-1 sm:block">
            {docked && (
              <motion.div
                layoutId={SEARCH_LAYOUT_ID}
                transition={SEARCH_DOCK_TRANSITION}
                className="mx-auto max-w-md"
              >
                <SearchBar variant="compact" />
              </motion.div>
            )}
          </div>

          {/* Keeps the buttons pinned right on phones. */}
          <div className="flex-1 sm:hidden" />

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-label={mobileSearchOpen ? 'Close search' : 'Search gift cards'}
              aria-expanded={mobileSearchOpen}
              className={`btn btn-glass h-10 w-10 !p-0 sm:hidden ${
                mobileSearchOpen ? '!border-[var(--border-strong)] !bg-[var(--surface-hover)]' : ''
              }`}
            >
              <Icon name={mobileSearchOpen ? 'close' : 'search'} className="h-[18px] w-[18px]" />
            </button>

            {/* Phones get search and profile only; themes live in
                Settings › Appearance there. */}
            <div className="hidden sm:block">
              <ThemeMenu />
            </div>

            <ProfileMenu />
          </div>
        </nav>

        {/* Full-width search on phones: the input and its suggestions get the
            whole screen instead of the ~100px left over in the bar. */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mt-2 sm:hidden"
            >
              <SearchBar variant="hero" autoFocus />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
