import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Cards you've bookmarked to watch.
 *
 * Kept per browser rather than per account: saving is useful before you've
 * signed up, and losing the list on sign-out would be a nasty surprise. Stores
 * brand ids only, so a saved card always reflects today's prices rather than a
 * snapshot taken when you saved it.
 */
interface SavedValue {
  saved: string[];
  isSaved: (brandId: string) => boolean;
  toggle: (brandId: string) => void;
  remove: (brandId: string) => void;
  clear: () => void;
}

export const SavedContext = createContext<SavedValue | null>(null);

const KEY = 'vaultly:saved';

const read = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<string[]>(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Blocked site data — the list just won't survive a reload.
    }
  }, [saved]);

  const toggle = useCallback((brandId: string) => {
    setSaved((list) =>
      // Newest first, so the settings list reads as a recent-activity feed.
      list.includes(brandId) ? list.filter((id) => id !== brandId) : [brandId, ...list],
    );
  }, []);

  const remove = useCallback(
    (brandId: string) => setSaved((list) => list.filter((id) => id !== brandId)),
    [],
  );

  const clear = useCallback(() => setSaved([]), []);

  const value = useMemo<SavedValue>(
    () => ({ saved, isSaved: (id) => saved.includes(id), toggle, remove, clear }),
    [saved, toggle, remove, clear],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
