# Medicine Tracker – frontend

React + [Mantine](https://mantine.dev/) + [TanStack Query](https://tanstack.com/query), built with [Vite+](https://viteplus.dev/) (`vp`).

## Scripts

- `yarn dev` – dev server; `/api/*` is proxied to the backend on `localhost:8000`
- `yarn build` – type-check and build to `dist/`
- `yarn check` / `yarn check:fix` – formatting, lint and types
- `yarn vitest` – run tests (`*.test.tsx`, render with `@test-utils`)
- `yarn knip` – find unused files, exports and dependencies
- `yarn test` – everything above, as CI would

In Docker, the app is built and served by Caddy, which also proxies `/api` to the backend (see `Caddyfile`).

## Credits

Pill icon by Vaadin on [Icon-Icons.com](https://icon-icons.com/authors/353-vaadin), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
