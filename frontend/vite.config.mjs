import react from '@vitejs/plugin-react';
import { oxfmt, oxlint } from 'oxc-config-mantine';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
  fmt: {
    ...oxfmt,
    ignorePatterns: [...oxfmt.ignorePatterns, 'dist', '*.html', '*.yml', '*.json', '*.css'],
  },
  lint: {
    ...oxlint,
    ignorePatterns: ['**/*.{mjs,cjs,js,d.ts,d.mts}', 'dist'],
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [
    react(),
    // Service worker: caches the built app (HTML/JS/CSS/icons) so it opens without a network.
    // API data is cached by TanStack Query instead (see App.tsx).
    VitePWA({
      registerType: 'autoUpdate', // a new deploy replaces the old cached app on next load
      manifest: false, // we keep our own public/manifest.webmanifest
      includeAssets: ['pill.svg', 'apple-touch-icon.png', 'manifest.webmanifest'],
      workbox: {
        // Client-side routes (/medications/3) get index.html offline, but never /api.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Image keys are random UUIDs that never change, so a cached copy is always right.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/images/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'medication-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ]),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.mjs',
    // No tests yet: don't fail `yarn test` until the first one is written.
    passWithNoTests: true,
  },

  resolve: {
    tsconfigPaths: true,
  },

  // Dev mirrors the Caddy setup: /api/* goes to the backend with the prefix stripped.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
