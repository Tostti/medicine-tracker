import '@mantine/core/styles.css';

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { MantineProvider } from '@mantine/core';
import { Router } from './Router';
import { theme } from './theme';

// How long cached results survive (in memory and in localStorage) to be shown offline.
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Must be >= maxAge, or results are dropped from memory before they can be saved.
      gcTime: CACHE_MAX_AGE,
      // Without a network, keep showing cached data instead of waiting for one.
      networkMode: 'offlineFirst',
    },
  },
});

// Every successful query is saved to localStorage and restored when the app opens.
const persister = createAsyncStoragePersister({ storage: window.localStorage });

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: CACHE_MAX_AGE,
          // Change this when the API's data shape changes, so old saved data is thrown away.
          buster: 'v1',
        }}
      >
        <Router />
      </PersistQueryClientProvider>
    </MantineProvider>
  );
}
