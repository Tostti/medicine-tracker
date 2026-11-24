import { aMedication, fireEvent, jsonResponse, mockFetch, renderApp, screen } from '@test-utils';
import type { Medication } from '../../api/medications';
import { MedicationSearch } from './MedicationSearch';

function setup(results: Medication[] = []) {
  const fetchMock = mockFetch(() => jsonResponse(results));
  const onClose = vi.fn();
  const view = renderApp(<MedicationSearch opened onClose={onClose} />);
  const searchFor = (text: string) =>
    fireEvent.change(screen.getByPlaceholderText('Name, drug, function or type'), {
      target: { value: text },
    });
  return { ...view, fetchMock, onClose, searchFor };
}

const searchedTerms = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.requests.map(({ url }) => url.searchParams.get('q'));

describe('MedicationSearch', () => {
  it('waits for two letters before searching', async () => {
    const { fetchMock, searchFor } = setup();

    searchFor(' t ');

    expect(screen.getByText('Type at least 2 letters')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches once typing pauses', async () => {
    const { fetchMock, searchFor } = setup([aMedication({ commercial_name: 'Tafirol' })]);

    searchFor('ta');
    searchFor('taf');
    searchFor('tafi ');

    expect(await screen.findByText('Tafirol')).toBeInTheDocument();
    // Only the last term, trimmed: the debounce skipped the keystrokes in between.
    expect(searchedTerms(fetchMock)).toEqual(['tafi']);
  });

  it('opens a result', async () => {
    const { router, onClose, searchFor } = setup([
      aMedication({ id: 7, commercial_name: 'Tafirol' }),
    ]);
    searchFor('taf');

    fireEvent.click(await screen.findByText('Tafirol'));

    expect(router.state.location.pathname).toBe('/medications/7');
    expect(onClose).toHaveBeenCalled();
  });

  it('offers to add the medication when nothing is found', async () => {
    const { router, searchFor } = setup([]);
    searchFor('Tafirol forte');

    expect(await screen.findByText('Nothing found for Tafirol forte')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add medication' }));

    expect(router.state.location.pathname).toBe('/medications/new');
    expect(router.state.location.search).toBe('?nombre=Tafirol%20forte');
  });

  it('shows the error when searching fails', async () => {
    mockFetch(() => jsonResponse(null, 500));
    renderApp(<MedicationSearch opened onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Name, drug, function or type'), {
      target: { value: 'taf' },
    });

    expect(await screen.findByText('Couldn’t load the medications')).toBeInTheDocument();
  });
});
