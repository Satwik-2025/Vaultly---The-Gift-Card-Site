import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Icon } from './components/Icon';
import { NewCardsBanner } from './components/NewCardsBanner';
import { Home } from './pages/Home';
import { SearchResults } from './pages/SearchResults';
import { BrandCompare } from './pages/BrandCompare';
import { Settings } from './pages/Settings';
import { SignIn } from './pages/SignIn';

/** Routes that are one page with a switch, not separate destinations. */
const AUTH_PATHS = ['/signin', '/signup'];

/**
 * Route changes land at the top of the new page — except when the URL carries
 * a hash, which means the visitor asked for a specific section.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    // A deep link (/settings#saved) owns the scroll position — jumping to the
    // top here would undo the smooth scroll the target page is about to do.
    if (hash) return;
    // Flipping between sign in and create account changes the form in place;
    // a jump to the top would be the one thing on screen that snaps.
    if (from !== pathname && AUTH_PATHS.includes(from) && AUTH_PATHS.includes(pathname)) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <div className="shell pt-20 pb-24 text-center">
      <p className="font-display text-faint text-6xl font-extrabold">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">This page doesn't exist</h1>
      <Link to="/" className="btn btn-primary mt-6">
        Back home
        <Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function App() {
  // Bumping this remounts the routed page so newly-discovered brands appear
  // without a manual reload.
  const [catalogVersion, setCatalogVersion] = useState(0);
  const onCatalogUpdated = useCallback(() => setCatalogVersion((v) => v + 1), []);

  return (
    <>
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <ScrollToTop />

      <a
        href="#main"
        className="btn btn-primary sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main">
        <Routes key={catalogVersion}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/gift-card/:brandId" element={<BrandCompare />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/signin" element={<SignIn mode="signin" />} />
          <Route path="/signup" element={<SignIn mode="signup" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />

      <NewCardsBanner onCatalogUpdated={onCatalogUpdated} />
    </>
  );
}
