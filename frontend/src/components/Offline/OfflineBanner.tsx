import { useSyncExternalStore } from 'react';
import { IconCloudOff } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@mantine/core';
import { useNetwork } from '@mantine/hooks';

/**
 * Tells the user they're looking at saved data, and from when.
 *
 * Shown when the device has no network, or when it has one but the server can't be
 * reached (e.g. away from the home network). fetch() rejects with a TypeError only in
 * that second case; HTTP errors like 404 or 422 come back as responses, so they don't count.
 */
export function OfflineBanner() {
  const { online } = useNetwork();
  const queryCache = useQueryClient().getQueryCache();
  const subscribe = (onChange: () => void) => queryCache.subscribe(onChange);

  const serverUnreachable = useSyncExternalStore(subscribe, () =>
    queryCache.getAll().some((query) => query.state.error instanceof TypeError)
  );

  // The newest successful fetch among all cached queries (0 = nothing saved yet).
  const lastUpdated = useSyncExternalStore(subscribe, () =>
    Math.max(0, ...queryCache.getAll().map((query) => query.state.dataUpdatedAt))
  );

  if (online && !serverUnreachable) {
    return null;
  }

  return (
    <Alert
      variant="light"
      color="yellow"
      icon={<IconCloudOff size={18} />}
      title={online ? 'Can’t reach the server' : 'You’re offline'}
      mb="md"
    >
      {lastUpdated > 0
        ? `Showing data saved on ${new Date(lastUpdated).toLocaleString()}. Changes can’t be saved until the connection is back.`
        : 'No saved data yet: open the app once while connected to keep a copy.'}
    </Alert>
  );
}
