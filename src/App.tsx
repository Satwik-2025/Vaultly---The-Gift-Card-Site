import { useCallback, useEffect, useState } from 'react';
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

/**
 * Route changes should land at the top of the new page — but never fight an
 * in-page smooth scroll, so this only fires when the path itself changes.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
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
