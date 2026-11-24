import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@test-utils';
import { OfflineBanner } from './OfflineBanner';

const SAVED_AT = new Date(2026, 10, 20, 9, 30).getTime();

// A query that already has saved data (as if restored from localStorage) and refetches with `queryFn`.
function setup(queryFn: () => Promise<string>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['medications'], 'saved', { updatedAt: SAVED_AT });

  function Consumer() {
    useQuery({ queryKey: ['medications'], queryFn });
    return null;
  }

  render(
    <QueryClientProvider client={client}>
      <OfflineBanner />
      <Consumer />
    </QueryClientProvider>
  );
}

describe('OfflineBanner', () => {
  it('shows when the server is unreachable, with the date of the saved data', async () => {
    // What fetch() throws when there is no route to the server.
    setup(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(await screen.findByText('Can’t reach the server')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(new Date(SAVED_AT).toLocaleString()))).toBeInTheDocument();
  });

  it('stays hidden for ordinary HTTP errors', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('Failed to fetch medications')));
    setup(failing);

    await vi.waitFor(() => expect(failing).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('stays hidden when the fetch succeeds', async () => {
    setup(() => Promise.resolve('fresh'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
