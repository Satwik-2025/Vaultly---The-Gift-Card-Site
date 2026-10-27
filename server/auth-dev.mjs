import { handleAuth } from './auth-core.mjs';

/**
 * /api/auth/:action on the Vite dev server, running the same core as the
 * deployed function. Accounts land in .data/dev-accounts.json.
 */
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

export function authMiddleware() {
  return async (req, res, next) => {
    const match = /^\/api\/auth\/([a-z]+)\/?(?:\?|$)/.exec(req.url ?? '');
    if (!match) return next();

    const result = await handleAuth({
      action: match[1],
      method: req.method,
      body: req.method === 'GET' ? {} : await readBody(req),
      cookie: req.headers.cookie,
      ip: req.socket.remoteAddress ?? 'unknown',
      secure: false,
    });

    res.statusCode = result.status;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    if (result.setCookie) res.setHeader('set-cookie', result.setCookie);
    res.end(JSON.stringify(result.json));
  };
}
