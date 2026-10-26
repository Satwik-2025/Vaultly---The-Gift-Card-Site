import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'dark' | 'light';

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);

const STORAGE_KEY = 'vaultly:theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // Dark is the designed default; only follow the OS when it explicitly asks for light.
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f2f3f9' : '#06060c');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  /**
   * Sweeps the new theme in diagonally from the top-left instead of swapping it
   * instantly. The View Transitions API snapshots the old and new frames for us;
   * the diagonal clip-path lives in index.css.
   *
   * Falls back to a plain swap where the API is missing (Firefox, older Safari)
   * or when the visitor has asked for reduced motion.
   */
  const toggle = useCallback(() => {
    const flip = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !document.startViewTransition) {
      flip();
      return;
    }

    // flushSync so the DOM is already updated when the transition captures it.
    document.startViewTransition(() => flushSync(flip));
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
