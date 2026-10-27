import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Accounts that follow you between devices.
 *
 * Sign-up, sign-in and the session all go through /api/auth (see
 * server/auth-core.mjs): the password is hashed on the server, and the browser
 * holds nothing but an HttpOnly session cookie. Sign in on a laptop and again
 * on a phone, and both see the same account and the same saved cards.
 *
 * Two things carry over from the older, browser-only accounts:
 *
 * - **A fallback.** If the API isn't there (a static preview) or says accounts
 *   aren't set up (a deployment without its database), sign-in quietly keeps
 *   working the old way, stored in this browser. `cloud` says which you got.
 * - **A one-time move.** An account made before this existed lives only in
 *   the browser that made it. Signing in there with its password checks the
 *   old record and recreates the account on the server — no second sign-up.
 */

export interface User {
  name: string;
  email: string;
  age: number;
  createdAt: string;
}

interface LocalAccount extends User {
  salt: string;
  hash: string;
}

interface AuthValue {
  user: User | null;
  signUp: (input: { name: string; email: string; age: number; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'age'>>) => Promise<void>;
  /** True until we know who's signed in, so the UI doesn't flash. */
  loading: boolean;
  /** Accounts are on the server and work across devices. */
  cloud: boolean;
  /**
   * The account's saved cards as the server last reported them, delivered
   * with the session so the saved list doesn't need a second round trip.
   */
  serverSaved: string[] | null;
}

export const AuthContext = createContext<AuthValue | null>(null);

const ACCOUNTS_KEY = 'vaultly:accounts';
const SESSION_KEY = 'vaultly:session';
/** Last known signed-in user, shown while the session check is in flight. */
const USER_CACHE_KEY = 'vaultly:user';

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
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked site data — it just won't survive a reload.
  }
};

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The browser-only accounts' hash, kept to check (and move) old accounts. */
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

const withoutSecrets = ({ salt: _s, hash: _h, ...user }: LocalAccount): User => user;

export const PASSWORD_RULES = 'At least 8 characters, with a letter and a number.';

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password)) return 'Password needs at least one letter.';
  if (!/\d/.test(password)) return 'Password needs at least one number.';
  return null;
}

/* ---------------------------------- API ---------------------------------- */

interface ApiResult {
  ok: boolean;
  status: number;
  error?: string;
  available?: boolean;
  user?: User | null;
  saved?: string[];
}

export async function authApi(
  action: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: unknown,
): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${action}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: 'Couldn’t reach Vaultly. Check your connection.' };
  }
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    return { ok: false, status: res.status, error: 'Something went wrong. Please try again.' };
  }
  return { ...json, status: res.status };
}

const raise = (result: ApiResult) => {
  throw new Error(result.error ?? 'Something went wrong. Please try again.');
};

/* -------------------------------- provider ------------------------------- */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readJson<User | null>(USER_CACHE_KEY, null));
  const [loading, setLoading] = useState(true);
  const [cloud, setCloud] = useState(false);
  const [serverSaved, setServerSaved] = useState<string[] | null>(null);

  // Remembered so the next visit can show you as signed in straight away.
  useEffect(() => writeJson(USER_CACHE_KEY, cloud ? user : null), [user, cloud]);

  useEffect(() => {
    let live = true;
    authApi('session', 'GET').then((result) => {
      if (!live) return;
      if (result.ok && result.available) {
        setCloud(true);
        setUser(result.user ?? null);
        setServerSaved(result.user ? (result.saved ?? []) : null);
      } else {
        // No accounts API here: browser-only sign-in, as before.
        const email = readJson<string | null>(SESSION_KEY, null);
        const found = email && readJson<LocalAccount[]>(ACCOUNTS_KEY, []).find((a) => a.email === email);
        setUser(found ? withoutSecrets(found) : null);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const signedIn = useCallback((result: ApiResult) => {
    setUser(result.user ?? null);
    setServerSaved(result.saved ?? []);
  }, []);

  const signUp = useCallback<AuthValue['signUp']>(
    async ({ name, email, age, password }) => {
      const bad = validatePassword(password);
      if (bad) throw new Error(bad);

      if (cloud) {
        const result = await authApi('signup', 'POST', { name, email, age, password });
        if (!result.ok) raise(result);
        return signedIn(result);
      }

      const accounts = readJson<LocalAccount[]>(ACCOUNTS_KEY, []);
      const id = normalise(email);
      if (accounts.some((a) => a.email === id)) {
        throw new Error('An account with that email already exists. Sign in instead.');
      }
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      const account: LocalAccount = {
        name: name.trim(),
        email: id,
        age,
        createdAt: new Date().toISOString(),
        salt,
        hash: await derive(password, salt),
      };
      writeJson(ACCOUNTS_KEY, [...accounts, account]);
      writeJson(SESSION_KEY, id);
      setUser(withoutSecrets(account));
    },
    [cloud, signedIn],
  );

  const signIn = useCallback<AuthValue['signIn']>(
    async ({ email, password }) => {
      const id = normalise(email);
      const accounts = readJson<LocalAccount[]>(ACCOUNTS_KEY, []);
      const local = accounts.find((a) => a.email === id);
      const localMatches = async () =>
        Boolean(local) && (await derive(password, local!.salt)) === local!.hash;

      // Same message either way, so this can't be used to discover which
      // emails have accounts.
      const wrong = new Error('That email and password don’t match an account.');

      if (cloud) {
        const result = await authApi('signin', 'POST', { email: id, password });
        if (result.ok) return signedIn(result);
        if (result.status !== 401 || !(await localMatches())) raise(result);

        // The account only exists in this browser, from before accounts moved
        // to the server. The password checks out against it, so move it.
        const moved = await authApi('signup', 'POST', {
          name: local!.name,
          email: id,
          age: local!.age,
          createdAt: local!.createdAt,
          password,
        });
        // 409: the email was registered on the server since, with a different
        // password. The server account wins; this password isn't its password.
        if (moved.status === 409) throw wrong;
        if (!moved.ok) raise(moved);
        writeJson(ACCOUNTS_KEY, accounts.filter((a) => a.email !== id));
        writeJson(SESSION_KEY, null);
        return signedIn(moved);
      }

      if (!(await localMatches())) throw wrong;
      writeJson(SESSION_KEY, id);
      setUser(withoutSecrets(local!));
    },
    [cloud, signedIn],
  );

  const signOut = useCallback<AuthValue['signOut']>(async () => {
    // Signed out here straight away, whatever the network does.
    setUser(null);
    setServerSaved(null);
    writeJson(SESSION_KEY, null);
    if (cloud) await authApi('signout', 'POST');
  }, [cloud]);

  const updateProfile = useCallback<AuthValue['updateProfile']>(
    async (patch) => {
      if (!user) return;
      if (cloud) {
        const result = await authApi('profile', 'PATCH', patch);
        if (!result.ok) raise(result);
        setUser(result.user ?? { ...user, ...patch });
        return;
      }
      const accounts = readJson<LocalAccount[]>(ACCOUNTS_KEY, []);
      writeJson(
        ACCOUNTS_KEY,
        accounts.map((a) => (a.email === user.email ? { ...a, ...patch } : a)),
      );
      setUser({ ...user, ...patch });
    },
    [cloud, user],
  );

  const value = useMemo<AuthValue>(
    () => ({ user, signUp, signIn, signOut, updateProfile, loading, cloud, serverSaved }),
    [user, signUp, signIn, signOut, updateProfile, loading, cloud, serverSaved],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
