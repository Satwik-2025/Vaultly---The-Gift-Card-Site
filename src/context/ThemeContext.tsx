import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_THEME, getTheme, isThemeId, THEMES, type Theme, type ThemeId } from '../themes';

interface ThemeValue {
  themeId: ThemeId;
  theme: Theme;
  /** `typeof THEMES` rather than Theme[], so ids stay literal for `select`. */
  themes: typeof THEMES;
  /** Switch to a specific palette. */
  select: (id: ThemeId) => void;
  /** Quick flip between the last dark and the last light palette you used. */
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);

const STORAGE_KEY = 'vaultly:theme';
/** Remembering both sides keeps the quick toggle returning to *your* palettes. */
const LAST_DARK_KEY = 'vaultly:theme:dark';
const LAST_LIGHT_KEY = 'vaultly:theme:light';

const read = (key: string, fallback: ThemeId): ThemeId => {
  try {
    const v = localStorage.getItem(key);
    return isThemeId(v) ? v : fallback;
  } catch {
    // Private browsing and blocked site data both throw here.
    return fallback;
  }
};

function initialTheme(): ThemeId {
  const saved = read(STORAGE_KEY, '' as ThemeId);
  if (saved) return saved;
  // Dark is the designed default; only follow the OS when it asks for light.
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'daylight'
    : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme);
  const theme = getTheme(themeId);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    // Every existing `.light …` rule keys off this class, so a light palette
    // inherits the whole light design system and only restates its colour.
    root.classList.toggle('light', theme.mode === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg);

    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
      localStorage.setItem(theme.mode === 'light' ? LAST_LIGHT_KEY : LAST_DARK_KEY, theme.id);
    } catch {
      // Not being able to remember the choice shouldn't break the page.
    }
  }, [theme]);

  /**
   * Sweeps the new theme in diagonally from the top-left instead of swapping it
   * instantly. The View Transitions API snapshots the old and new frames for us;
   * the diagonal clip-path lives in index.css.
   *
   * Falls back to a plain swap where the API is missing (Firefox, older Safari)
   * or when the visitor has asked for reduced motion.
   */
  const transition = useCallback((apply: () => void) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !document.startViewTransition) {
      apply();
      return;
    }
    // flushSync so the DOM is already updated when the transition captures it.
    document.startViewTransition(() => flushSync(apply));
  }, []);

  const select = useCallback(
    (id: ThemeId) => {
      if (id === themeId) return;
      transition(() => setThemeId(id));
    },
    [themeId, transition],
  );

  const toggle = useCallback(() => {
    transition(() =>
      setThemeId((current) => {
        const mode = getTheme(current).mode;
        return mode === 'dark'
          ? read(LAST_LIGHT_KEY, 'daylight')
          : read(LAST_DARK_KEY, DEFAULT_THEME);
      }),
    );
  }, [transition]);

  const value = useMemo<ThemeValue>(
    () => ({ themeId, theme, themes: THEMES, select, toggle }),
    [themeId, theme, select, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
