import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as gyftr from '../../scripts/sources/gyftr.mjs';
import * as woohoo from '../../scripts/sources/woohoo.mjs';
import * as cashkaro from '../../scripts/sources/cashkaro.mjs';
import { computeRefresh } from '../../server/refresh-core.mjs';

/**
 * GET /api/refresh/:brandId on Vercel — the deployed "Re-check prices now".
 *
 * Same core as the dev server, with two differences forced by serverless:
 *
 * - No Amazon. It needs a real Chrome via Playwright, which is too large and
 *   too slow for a function (8–25s against a ~1–2s budget for the others).
 *   Its existing offer is kept as-is and refreshed by the daily scrape, and
 *   the page marks that panel as an older reading.
 * - Nothing is saved. The filesystem is read-only, so the fresh prices go back
 *   to whoever asked rather than into catalog.json for the next visitor. The
 *   daily scrape is what moves the shared catalog forward.
 *
 * Importing only the HTTP sellers also keeps Playwright out of the bundle.
 */
const SOURCES = { gyftr, woohoo };

let catalog = null;
const loadCatalog = () =>
  // Bundled with the function via `includeFiles` in vercel.json.
  (catalog ??= JSON.parse(readFileSync(join(process.cwd(), 'public', 'catalog.json'), 'utf8')));

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');

  const brandId = String(req.query?.brandId ?? '');
  const brand = brandId && loadCatalog().brands.find((b) => b.id === brandId);
  if (!brand) {
    res.status(404).json({ ok: false, error: `Unknown brand: ${brandId}` });
    return;
  }

  try {
    const { brand: fresh, changes, delisted } = await computeRefresh({
      brand,
      sources: SOURCES,
      cashkaro,
    });
    res.status(200).json({ ok: true, brand: fresh, changes, delisted });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
