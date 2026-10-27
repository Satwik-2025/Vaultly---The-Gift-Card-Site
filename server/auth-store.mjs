import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Where accounts live.
 *
 * On Vercel that's Upstash Redis, connected from the project's Storage tab —
 * the integration injects KV_REST_API_URL / KV_REST_API_TOKEN (older setups
 * use the UPSTASH_REDIS_REST_* names). It's spoken to over its REST API with
 * plain fetch, so there's no client library to bundle.
 *
 * On the dev server there's no Redis, so a JSON file under .data/ stands in
 * with the same five operations. It's never used on Vercel: the filesystem
 * there is read-only, and silently keeping accounts in a function's memory
 * would lose them on the next cold start. Without Redis configured, the
 * deployed API says accounts aren't available and the site falls back to
 * browser-only sign-in.
 */

const restUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

function redisStore(url, token) {
  const pipeline = async (commands) => {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Account store answered ${res.status}`);
    const out = await res.json();
    const failed = out.find((r) => r.error);
    if (failed) throw new Error(`Account store error: ${failed.error}`);
    return out.map((r) => r.result);
  };
  const one = async (...command) => (await pipeline([command]))[0];

  return {
    get: (key) => one('GET', key),
    set: (key, value, ttl) => (ttl ? one('SET', key, value, 'EX', ttl) : one('SET', key, value)),
    /** True if the key was free and is now ours — how sign-up claims an email. */
    claim: async (key, value) => (await one('SET', key, value, 'NX')) === 'OK',
    del: (key) => one('DEL', key),
    /** Counts within a window that starts at the first hit. */
    hit: async (key, ttl) => (await pipeline([['INCR', key], ['EXPIRE', key, ttl, 'NX']]))[0],
  };
}

function fileStore(path) {
  const load = () => {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return {};
    }
  };
  const save = (data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, JSON.stringify(data, null, 2));
    renameSync(`${path}.tmp`, path);
  };
  const live = (entry) => entry && (!entry.expires || entry.expires > Date.now());
  const read = (key) => {
    const entry = load()[key];
    return live(entry) ? entry.value : null;
  };
  const write = (key, value, ttl) => {
    const data = load();
    data[key] = { value, expires: ttl ? Date.now() + ttl * 1000 : null };
    save(data);
  };

  return {
    get: async (key) => read(key),
    set: async (key, value, ttl) => write(key, value, ttl),
    claim: async (key, value) => {
      if (read(key) !== null) return false;
      write(key, value);
      return true;
    },
    del: async (key) => {
      const data = load();
      delete data[key];
      save(data);
    },
    hit: async (key, ttl) => {
      const data = load();
      const entry = live(data[key]) ? data[key] : { value: 0, expires: Date.now() + ttl * 1000 };
      entry.value += 1;
      data[key] = entry;
      save(data);
      return entry.value;
    },
  };
}

export const store =
  restUrl && restToken
    ? redisStore(restUrl, restToken)
    : process.env.VERCEL
      ? null
      : fileStore(join(process.cwd(), '.data', 'dev-accounts.json'));
