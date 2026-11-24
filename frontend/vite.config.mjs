import react from '@vitejs/plugin-react';
import { oxfmt, oxlint } from 'oxc-config-mantine';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
  fmt: {
    ...oxfmt,
    ignorePatterns: [
      ...oxfmt.ignorePatterns,
      'dist',
      '*.html',
      '*.yml',
      '*.json',
      '*.css',
    ],
  },
  lint: {
    ...oxlint,
    ignorePatterns: ['**/*.{mjs,cjs,js,d.ts,d.mts}', 'dist'],
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [react()]),
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
