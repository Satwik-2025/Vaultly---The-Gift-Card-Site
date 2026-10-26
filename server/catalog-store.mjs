import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG = join(ROOT, 'public', 'catalog.json');

/**
 * The one place catalog.json is written.
 *
 * Two things write it — the per-brand price refresh and the catalog sync — and
 * both used to read it, spend ten to thirty seconds on the network, then write
 * their copy back. Whichever finished last silently reverted the other: a sync
 * would correctly drop 17 delisted cards, and a refresh that had started
 * earlier would put all 17 straight back, so delisted cards never actually
 * disappeared.
 *
 * The fix is to never hold catalog data across network work. Callers do their
 * fetching first, then hand `update` a function that applies the result to a
 * freshly-read catalog, under a lock. That makes the read-modify-write atomic
 * with respect to other writers in this process.
 */

export const readCatalog = () => JSON.parse(readFileSync(CATALOG, 'utf8'));

/** Serialises writers; each waits for the previous one to finish. */
let queue = Promise.resolve();

export function update(apply) {
  const run = queue.then(async () => {
    const catalog = readCatalog();
    const result = await apply(catalog);
    catalog.generatedAt = new Date().toISOString();

    // Written via a temp file so a reader never sees a half-written catalog —
    // the dev server serves this file to the browser while we write it.
    const tmp = `${CATALOG}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(catalog));
    renameSync(tmp, CATALOG);

    return result;
  });

  // Keep the chain alive even if one writer throws.
  queue = run.catch(() => {});
  return run;
}
