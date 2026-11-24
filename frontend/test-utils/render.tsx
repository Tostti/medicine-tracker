import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as testingLibraryRender } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
// jsdom reports an English browser ('en-US'), so tests render the English texts.
import '../src/i18n';
import { theme } from '../src/theme';

export function render(ui: React.ReactNode) {
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider theme={theme} env="test">
        {children}
      </MantineProvider>
    ),
  });
}

interface RenderAppOptions {
  // Where the app is when the test starts, e.g. '/medications/3'.
  route?: string;
  // The route pattern `ui` is mounted on, so it can read params like :id. Defaults to `route`.
  path?: string;
}

/**
 * Like `render`, plus what pages and data components need: a fresh TanStack Query client
 * (no retries, so errors show at once) and a router. `router.state.location` tells where
 * the component navigated to.
 */
export function renderApp(ui: React.ReactNode, { route = '/', path }: RenderAppOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: path ?? route.split('?')[0], element: ui },
      // Navigation targets render a marker, so a test can see the page changed.
      { path: '*', element: <div data-testid="other-page" /> },
    ],
    { initialEntries: [route] }
  );
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { ...result, queryClient, router };
}
