import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Local-only accounts.
 *
 * There is no server in this project — the catalog is a static file and the two
 * API routes are dev-server middleware — so an account lives in this browser's
 * localStorage and nowhere else. That makes it a real sign-in flow for the UI
 * (gated pages, a profile, per-account settings) and *not* real authentication:
 * anyone with devtools can read the store, and nothing is verified.
 *
 * Passwords are still never kept in the clear. Each account gets a random salt
 * and we store PBKDF2-SHA-256 over the password, so the stored value isn't
 * directly reusable. Treat it as damage limitation for people who reuse
 * passwords, not as security. Swap this provider for real API calls the moment
 * a backend exists — the surface below is deliberately the same shape.
 */

export interface User {
  name: string;
  email: string;
  age: number;
  createdAt: string;
}

interface StoredAccount extends User {
  salt: string;
  hash: string;
}

interface AuthValue {
  user: User | null;
  signUp: (input: { name: string; email: string; age: number; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'age'>>) => void;
  /** True until the stored session has been read, so the UI doesn't flash. */
  loading: boolean;
}

export const AuthContext = createContext<AuthValue | null>(null);

const ACCOUNTS_KEY = 'vaultly:accounts';
const SESSION_KEY = 'vaultly:session';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked site data — the session just won't survive a reload.
  }
};

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** PBKDF2 so a leaked store can't be reversed with a plain rainbow table. */
async function derive(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

const normalise = (email: string) => email.trim().toLowerCase();

export const PASSWORD_RULES = 'At least 8 characters, with a letter and a number.';

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Password needs at least one letter.';
  if (!/\d/.test(password)) return 'Password needs at least one number.';
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const email = readJson<string | null>(SESSION_KEY, null);
    if (email) {
      const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
      const found = accounts.find((a) => a.email === email);
      if (found) {
        const { salt: _salt, hash: _hash, ...safe } = found;
        setUser(safe);
      }
    }
    setLoading(false);
  }, []);

  const signUp = useCallback<AuthValue['signUp']>(async ({ name, email, age, password }) => {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
    const id = normalise(email);

    if (accounts.some((a) => a.email === id)) {
      throw new Error('An account with that email already exists. Sign in instead.');
    }
    const bad = validatePassword(password);
    if (bad) throw new Error(bad);

    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const account: StoredAccount = {
      name: name.trim(),
      email: id,
      age,
      createdAt: new Date().toISOString(),
      salt,
      hash: await derive(password, salt),
    };

    writeJson(ACCOUNTS_KEY, [...accounts, account]);
    writeJson(SESSION_KEY, id);
    const { salt: _s, hash: _h, ...safe } = account;
    setUser(safe);
  }, []);

  const signIn = useCallback<AuthValue['signIn']>(async ({ email, password }) => {
    const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
    const found = accounts.find((a) => a.email === normalise(email));

    // Same message either way, so this can't be used to discover which emails
    // have accounts.
    const wrong = new Error('That email and password don’t match an account.');
    if (!found) throw wrong;
    if ((await derive(password, found.salt)) !== found.hash) throw wrong;

    writeJson(SESSION_KEY, found.email);
    const { salt: _s, hash: _h, ...safe } = found;
    setUser(safe);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing to do — the in-memory session is cleared regardless.
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback<AuthValue['updateProfile']>((patch) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      const accounts = readJson<StoredAccount[]>(ACCOUNTS_KEY, []);
      writeJson(
        ACCOUNTS_KEY,
        accounts.map((a) => (a.email === current.email ? { ...a, ...patch } : a)),
      );
      return next;
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, signUp, signIn, signOut, updateProfile, loading }),
    [user, signUp, signIn, signOut, updateProfile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
