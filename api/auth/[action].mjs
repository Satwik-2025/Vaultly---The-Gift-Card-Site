import { handleAuth } from '../../server/auth-core.mjs';

/**
 * /api/auth/:action on Vercel — accounts that work on every device.
 * All the logic is in server/auth-core.mjs; this only adapts the request.
 */
export default async function handler(req, res) {
  const result = await handleAuth({
    action: String(req.query?.action ?? ''),
    method: req.method,
    body: req.body,
    cookie: req.headers.cookie,
    ip: String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown',
    secure: true,
  });

  res.setHeader('cache-control', 'no-store');
  if (result.setCookie) res.setHeader('set-cookie', result.setCookie);
  res.status(result.status).json(result.json);
}
