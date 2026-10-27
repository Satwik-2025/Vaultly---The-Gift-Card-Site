import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext, authApi } from './AuthContext';

/**
 * Cards you've bookmarked to watch.
 *
 * Signed in, the list belongs to the account and lives on the server, so the
 * card you save on your phone is there on your laptop. Signed out, it's kept
 * in this browser — saving is useful before you've signed up — and the first
 * sign-in folds those cards into the account rather than dropping them.
 *
 * Stores brand ids only, so a saved card always reflects today's prices rather
 * than a snapshot taken when you saved it.
 */
interface SavedValue {
  saved: string[];
  isSaved: (brandId: string) => boolean;
  toggle: (brandId: string) => void;
  remove: (brandId: string) => void;
  clear: () => void;
}

export const SavedContext = createContext<SavedValue | null>(null);

const GUEST_KEY = 'vaultly:saved';
/** The signed-in account's list, cached so a reload doesn't flash it empty. */
const ACCOUNT_KEY = 'vaultly:saved:account';

/** Whose list is showing — an account's email, or null for this browser's. */
interface SavedState {
  owner: string | null;
  list: string[];
}

const ids = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];

function readGuest(): string[] {
  try {
    return ids(JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

function initialState(): SavedState {
  try {
    const user = JSON.parse(localStorage.getItem('vaultly:user') ?? 'null');
    const cached = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null');
    if (user?.email && cached?.owner === user.email) {
      return { owner: user.email, list: ids(cached.list) };
    }
  } catch {
    // Fall through to this browser's list.
  }
  return { owner: null, list: readGuest() };
}

type Change = { add?: string[]; remove?: string[]; clear?: true };

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('SavedProvider must be inside <AuthProvider>');
  const { user, cloud, loading, serverSaved } = auth;
  const account = cloud && user ? user.email : null;
  const [state, setState] = useState<SavedState>(initialState);

  useEffect(() => {
    try {
      if (state.owner) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state));
      else localStorage.setItem(GUEST_KEY, JSON.stringify(state.list));
    } catch {
      // Blocked site data — the list just won't survive a reload.
    }
  }, [state]);

  /*
    Only the newest request's answer is applied. Toggle two cards quickly and
    the replies can come back out of order; the last one sent is the one that
    knows about both.
  */
  const latest = useRef(0);
  const send = useCallback(async (owner: string, change: Change) => {
    const mine = ++latest.current;
    const result = await authApi('saved', 'PATCH', change);
    if (result.ok && result.saved && mine === latest.current) {
      const list = result.saved;
      setState((s) => (s.owner === owner ? { owner, list } : s));
    }
  }, []);

  // Follow sign-in and sign-out.
  useEffect(() => {
    if (loading) return;
    if (!account) {
      // Signed out: this browser's list, and no copy of the account's left
      // behind on what might be a shared device.
      try {
        localStorage.removeItem(ACCOUNT_KEY);
      } catch {
        // Nothing to remove if storage is blocked.
      }
      setState({ owner: null, list: readGuest() });
      return;
    }
    if (!serverSaved) return;

    const fromGuest = readGuest().filter((id) => !serverSaved.includes(id));
    setState({ owner: account, list: [...fromGuest, ...serverSaved] });
    if (fromGuest.length) {
      // They're the account's now; leaving them here too would bring them
      // back after signing out.
      try {
        localStorage.setItem(GUEST_KEY, '[]');
      } catch {
        // Nothing to clean up if storage is blocked.
      }
      void send(account, { add: fromGuest });
    }
  }, [loading, account, serverSaved, send]);

  // Coming back to the tab picks up whatever you saved on another device.
  useEffect(() => {
    if (!account) return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const mine = latest.current;
      const result = await authApi('session', 'GET');
      // Skip it if a change was sent meanwhile — that reply is fresher.
      if (result.ok && result.user?.email === account && mine === latest.current) {
        const list = result.saved ?? [];
        setState((s) => (s.owner === account ? { owner: account, list } : s));
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [account]);

  const toggle = useCallback(
    (brandId: string) => {
      const has = state.list.includes(brandId);
      setState((s) => ({
        ...s,
        // Newest first, so the settings list reads as a recent-activity feed.
        list: has ? s.list.filter((id) => id !== brandId) : [brandId, ...s.list],
      }));
      if (account) void send(account, has ? { remove: [brandId] } : { add: [brandId] });
    },
    [state.list, account, send],
  );

  const remove = useCallback(
    (brandId: string) => {
      setState((s) => ({ ...s, list: s.list.filter((id) => id !== brandId) }));
      if (account) void send(account, { remove: [brandId] });
    },
    [account, send],
  );

  const clear = useCallback(() => {
    setState((s) => ({ ...s, list: [] }));
    if (account) void send(account, { clear: true });
  }, [account, send]);

  const saved = state.list;
  const value = useMemo<SavedValue>(
    () => ({ saved, isSaved: (id) => saved.includes(id), toggle, remove, clear }),
    [saved, toggle, remove, clear],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
