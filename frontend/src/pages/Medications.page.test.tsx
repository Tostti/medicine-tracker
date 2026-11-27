import { aMedication, fireEvent, jsonResponse, mockFetch, renderApp, screen } from '@test-utils';
import { MedicationsPage } from './Medications.page';

function setup(route = '/medications') {
  const fetchMock = mockFetch(() =>
    jsonResponse([
      aMedication({ commercial_name: 'Tafirol' }),
      aMedication({ commercial_name: 'Aspirina' }),
    ])
  );
  const rendered = renderApp(<MedicationsPage />, { route, path: '/medications' });
  return { fetchMock, ...rendered };
}

// The query string of the latest request, as an object.
const lastQuery = (fetchMock: ReturnType<typeof mockFetch>) =>
  Object.fromEntries(fetchMock.requests.at(-1)!.url.searchParams);

describe('MedicationsPage filters', () => {
  it('asks for the first page by name when the URL has no filters', async () => {
    const { fetchMock } = setup();
    await screen.findByText('Tafirol');

    expect(lastQuery(fetchMock)).toEqual({ sort: 'name', skip: '0', limit: '20' });
  });

  it('sends the filters from the URL to the backend', async () => {
    const { fetchMock } = setup('/medications?buscar=taf&en-stock=&esencial=&orden=recientes');
    await screen.findByText('Tafirol');

    expect(lastQuery(fetchMock)).toEqual({
      q: 'taf',
      in_stock: 'true',
      essential: 'true',
      sort: 'newest',
      skip: '0',
      limit: '20',
    });
    expect(screen.getByRole('checkbox', { name: 'In stock' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Essential' })).toBeChecked();
  });

  it('keeps the filters in the URL as they change', async () => {
    const { router } = setup();
    await screen.findByText('Tafirol');

    fireEvent.click(screen.getByRole('checkbox', { name: 'In stock' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter medications' }), {
      target: { value: 'taf' },
    });

    expect(router.state.location.search).toBe('?buscar=taf&en-stock=');
  });

  it('waits until typing pauses before searching', async () => {
    const { fetchMock } = setup();
    await screen.findByText('Tafirol');
    const input = screen.getByRole('textbox', { name: 'Filter medications' });

    fireEvent.change(input, { target: { value: 't' } });
    fireEvent.change(input, { target: { value: 'ta' } });
    fireEvent.change(input, { target: { value: 'taf' } });

    await vi.waitFor(() => expect(lastQuery(fetchMock).q).toBe('taf'));
    expect(fetchMock.requests.map((r) => r.url.searchParams.get('q'))).toEqual([null, 'taf']);
  });

  it('offers to clear the filters when nothing matches', async () => {
    mockFetch(() => jsonResponse([]));
    const { router } = renderApp(<MedicationsPage />, {
      route: '/medications?en-stock=&orden=recientes',
      path: '/medications',
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));
    // The sort isn't a filter: it stays.
    expect(router.state.location.search).toBe('?orden=recientes');
  });
});
