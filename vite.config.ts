import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error -- plain JS module, no types needed for a dev-only middleware
import { refreshMiddleware } from './server/refresh.mjs';
// @ts-expect-error -- plain JS module
import { discoverMiddleware } from './server/discover.mjs';
// @ts-expect-error -- plain JS module
import { authMiddleware } from './server/auth-dev.mjs';

/**
 * Serves the live endpoints:
 *   GET /api/refresh/:brandId  re-reads one brand's prices from every seller
 *   GET /api/discover          finds gift cards listed since the last scrape
 *   /api/auth/:action          accounts and saved cards (same core as Vercel)
 *
 * Both run inside the dev server, so there's no second process to start.
 */
const liveApi = (): PluginOption => ({
  name: 'vaultly-live-api',
  configureServer(server) {
    server.middlewares.use(refreshMiddleware());
    server.middlewares.use(discoverMiddleware());
    server.middlewares.use(authMiddleware());
  },
  configurePreviewServer(server) {
    server.middlewares.use(refreshMiddleware());
    server.middlewares.use(discoverMiddleware());
    server.middlewares.use(authMiddleware());
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), liveApi()],
  server: {
    port: 5173,
    watch: {
      /*
        The live endpoints rewrite `public/catalog.json`, and Vite watches
        `public/`. Left alone, every write full-reloads the page, which reloads
        the app, which calls the sync again — a loop that also threw away the
        banner before it could render.

        Matched with a predicate rather than a glob: the glob form silently
        failed to match on Windows, where the watcher reports backslash paths.
        The `.tmp` file the atomic write renames from has to be ignored too,
        and so does `.data/`, where the dev server keeps accounts.
      */
      ignored: (path: string) =>
        /catalog\.json(\.\d+\.tmp)?$/.test(path) || /[\\/]\.data[\\/]/.test(path),
    },
  },
});
