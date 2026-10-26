const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Polite fetch: identifies as a normal browser, retries transient failures with
 * backoff, and gives up rather than hammering a host that is refusing us.
 */
export async function fetchText(url, { retries = 2, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        redirect: 'follow',
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-IN,en;q=0.9',
        },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = await res.text();
      return { body, status: res.status, finalUrl: res.url };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(600 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** Runs `worker` over `items` with bounded concurrency and a small delay between starts. */
export async function mapPool(items, concurrency, worker, { onProgress, gapMs = 120 } = {}) {
  const results = [];
  let index = 0;
  let done = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      if (gapMs) await sleep(gapMs);
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = { error: String(e?.message ?? e), item: items[i] };
      }
      onProgress?.(++done, items.length);
    }
  });

  await Promise.all(runners);
  return results;
}

export function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}
