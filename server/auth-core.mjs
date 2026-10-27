import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { store } from './auth-store.mjs';

/**
 * Accounts and saved cards, behind /api/auth/:action.
 *
 * Written against a plain request object rather than Vercel's or Vite's, so
 * the deployed function and the dev server run exactly this code:
 *
 *   handleAuth({ action, method, body, cookie, ip, secure })
 *     → { status, json, setCookie? }
 *
 * What's stored, and how:
 *   user:<email>       profile plus a scrypt hash of the password
 *   saved:<email>      the account's saved brand ids, newest first
 *   session:<sha256>   the signed-in email, for 30 days
 *
 * The browser only ever holds the session token, in an HttpOnly cookie that
 * page scripts can't read. The store keeps a hash of that token, so even a
 * full copy of the database can't be replayed as anyone's session.
 */

const scrypt = promisify(scryptCb);

const COOKIE = 'vaultly_session';
const SESSION_DAYS = 30;
const SESSION_TTL = SESSION_DAYS * 24 * 60 * 60;

// Ten wrong guesses per email (and per network) per 15 minutes.
const GUESS_LIMIT = 10;
const GUESS_WINDOW = 15 * 60;

const MAX_SAVED = 500;

const normaliseEmail = (email) => String(email ?? '').trim().toLowerCase();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/* ---------- passwords ---------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function checkPassword(password, stored) {
  const [scheme, N, r, p, salt, key] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

// Checked against when the email has no account, so a miss takes as long as a
// wrong password and the timing doesn't reveal which emails are registered.
const decoy = hashPassword(randomBytes(12).toString('hex'));

/* ---------- validation (mirrors the sign-up form) ---------- */

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (password.length > 200) return 'That password is too long.';
  if (!/[a-zA-Z]/.test(password)) return 'Password needs at least one letter.';
  if (!/\d/.test(password)) return 'Password needs at least one number.';
  return null;
}

function validateProfile({ name, age }) {
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return 'Please enter your name.';
    if (name.trim().length > 80) return 'That name is too long.';
  }
  if (age !== undefined) {
    if (!Number.isInteger(age) || age < 13 || age > 120) {
      return 'Please enter an age between 13 and 120.';
    }
  }
  return null;
}

const validEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validBrandId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/i.test(id);

/* ---------- records ---------- */

const publicUser = ({ name, email, age, createdAt }) => ({ name, email, age, createdAt });

async function readUser(email) {
  const raw = await store.get(`user:${email}`);
  return raw ? JSON.parse(raw) : null;
}

async function readSaved(email) {
  const raw = await store.get(`saved:${email}`);
  return raw ? JSON.parse(raw) : [];
}

function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const sessionCookie = (token, secure) =>
  [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${token ? SESSION_TTL : 0}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

async function startSession(email, secure) {
  const token = randomBytes(32).toString('base64url');
  await store.set(`session:${sha256(token)}`, email, SESSION_TTL);
  return sessionCookie(token, secure);
}

async function currentEmail(cookie) {
  const token = readCookie(cookie, COOKIE);
  return token ? await store.get(`session:${sha256(token)}`) : null;
}

/* ---------- actions ---------- */

const ok = (json, extra) => ({ status: 200, json: { ok: true, ...json }, ...extra });
const fail = (status, error) => ({ status, json: { ok: false, error } });

const WRONG = 'That email and password don’t match an account.';

const actions = {
  /** Who's signed in — also how the page learns accounts are available. */
  async session({ cookie }) {
    const email = await currentEmail(cookie);
    const user = email && (await readUser(email));
    if (!user) return ok({ available: true, user: null, saved: [] });
    return ok({ available: true, user: publicUser(user), saved: await readSaved(email) });
  },

  async signup({ body, secure }) {
    const email = normaliseEmail(body.email);
    const name = typeof body.name === 'string' ? body.name.trim() : body.name;
    const age = Number(body.age);
    if (!validEmail(email)) return fail(400, 'Please enter a valid email address.');
    const bad = validateProfile({ name, age }) ?? validatePassword(body.password);
    if (bad) return fail(400, bad);

    // An account carried over from browser-only sign-in keeps its original
    // creation date; anything else is "now".
    const created = Date.parse(body.createdAt);
    const createdAt =
      Number.isFinite(created) && created <= Date.now()
        ? new Date(created).toISOString()
        : new Date().toISOString();

    const user = { name, email, age, createdAt, password: await hashPassword(body.password) };
    if (!(await store.claim(`user:${email}`, JSON.stringify(user)))) {
      return fail(409, 'An account with that email already exists. Sign in instead.');
    }
    return ok(
      { user: publicUser(user), saved: [] },
      { setCookie: await startSession(email, secure) },
    );
  },

  async signin({ body, ip, secure }) {
    const email = normaliseEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    const tries = await Promise.all([
      store.hit(`guess:email:${email}`, GUESS_WINDOW),
      store.hit(`guess:ip:${ip}`, GUESS_WINDOW),
    ]);
    // The network gets more room than one email: a family or an office can
    // share an address.
    if (tries[0] > GUESS_LIMIT || tries[1] > GUESS_LIMIT * 5) {
      return fail(429, 'Too many attempts. Please wait 15 minutes and try again.');
    }

    const user = email && (await readUser(email));
    const matches = await checkPassword(password, user ? user.password : await decoy);
    if (!user || !matches) return fail(401, WRONG);

    // A successful sign-in clears this email's count, so a typo or two
    // doesn't count against the next visit.
    await store.del(`guess:email:${email}`);
    return ok(
      { user: publicUser(user), saved: await readSaved(email) },
      { setCookie: await startSession(email, secure) },
    );
  },

  async signout({ cookie, secure }) {
    const token = readCookie(cookie, COOKIE);
    if (token) await store.del(`session:${sha256(token)}`);
    return ok({}, { setCookie: sessionCookie('', secure) });
  },

  async profile({ cookie, body }) {
    const email = await currentEmail(cookie);
    const user = email && (await readUser(email));
    if (!user) return fail(401, 'Please sign in again.');

    const patch = {};
    if (body.name !== undefined) patch.name = typeof body.name === 'string' ? body.name.trim() : body.name;
    if (body.age !== undefined) patch.age = Number(body.age);
    const bad = validateProfile(patch);
    if (bad) return fail(400, bad);

    const next = { ...user, ...patch };
    await store.set(`user:${email}`, JSON.stringify(next));
    return ok({ user: publicUser(next) });
  },

  /**
   * Changes are sent as adds and removes rather than the whole list, so a
   * phone and a laptop saving different cards at the same time both win.
   */
  async saved({ cookie, body }) {
    const email = await currentEmail(cookie);
    if (!email || !(await readUser(email))) return fail(401, 'Please sign in again.');

    const add = Array.isArray(body.add) ? body.add.filter(validBrandId) : [];
    const remove = new Set(Array.isArray(body.remove) ? body.remove.filter(validBrandId) : []);

    let list = body.clear === true ? [] : await readSaved(email);
    list = list.filter((id) => !remove.has(id) && !add.includes(id));
    list = [...add, ...list].slice(0, MAX_SAVED);

    await store.set(`saved:${email}`, JSON.stringify(list));
    return ok({ saved: list });
  },
};

const METHODS = {
  session: 'GET',
  signup: 'POST',
  signin: 'POST',
  signout: 'POST',
  profile: 'PATCH',
  saved: 'PATCH',
};

export async function handleAuth({ action, method, body, cookie, ip, secure }) {
  // Not connected yet: the page reads this and keeps sign-in in the browser.
  if (!store) {
    return action === 'session'
      ? ok({ available: false, user: null, saved: [] })
      : fail(503, 'Accounts aren’t set up on this deployment yet.');
  }

  const run = actions[action];
  if (!run) return fail(404, `Unknown action: ${action}`);
  if (method !== METHODS[action]) return fail(405, `Use ${METHODS[action]} for ${action}.`);

  try {
    return await run({ body: body && typeof body === 'object' ? body : {}, cookie, ip, secure });
  } catch (err) {
    console.error(`[auth] ${action}:`, err);
    return fail(500, 'Something went wrong on our side. Please try again.');
  }
}
