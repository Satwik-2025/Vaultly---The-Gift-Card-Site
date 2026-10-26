import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

interface SearchDockValue {
  /**
   * True when the search bar belongs in the navbar, false when it belongs in
   * the page hero. Exactly one of the two renders it, so there is never a
   * moment with two search bars on screen.
   */
  docked: boolean;
  setDocked: (docked: boolean) => void;
  /**
   * Whether docking applies at all. Below `sm` the navbar has no room for an
   * inline bar — it uses a search icon and a sheet — so the hero keeps its own.
   */
  canDock: boolean;
}

export const SearchDockContext = createContext<SearchDockValue | null>(null);

/** The shared `layoutId`, which is what makes the bar fly between the two slots. */
export const SEARCH_LAYOUT_ID = 'global-search';

/**
 * Spring rather than a fixed duration: the bar travels a different distance
 * depending on where you stopped scrolling, and a spring keeps the motion
 * feeling consistent across those distances. Damped just short of a bounce.
 */
export const SEARCH_DOCK_TRANSITION = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 38,
  mass: 0.9,
};

export function SearchDockProvider({ children }: { children: React.ReactNode }) {
  // Pages without a hero (search, brand) want it docked from the start.
  const [docked, setDocked] = useState(true);
  const [canDock, setCanDock] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = () => setCanDock(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const set = useCallback((next: boolean) => setDocked(next), []);

  const value = useMemo<SearchDockValue>(
    // With no room to dock, the bar simply stays in the hero.
    () => ({ docked: canDock ? docked : false, setDocked: set, canDock }),
    [docked, set, canDock],
  );

  return <SearchDockContext.Provider value={value}>{children}</SearchDockContext.Provider>;
}
