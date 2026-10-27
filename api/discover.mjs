/**
 * GET /api/discover on Vercel.
 *
 * The page-load catalog sync can't run here: it works by rewriting
 * catalog.json, and a serverless filesystem is read-only. On the deployed site
 * the daily scrape (.github/workflows/refresh-prices.yml) does that job — it
 * adds newly listed cards and drops delisted ones, then commits, which
 * redeploys.
 *
 * This endpoint exists so the page gets a clean "nothing new" answer instead
 * of a 404 in the console. The client already treats it that way.
 */
export default function handler(_req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    ok: true,
    added: 0,
    removed: 0,
    brands: [],
    removedBrands: [],
    skipped: 'catalog is synced by the daily scheduled scrape on this deployment',
  });
}
