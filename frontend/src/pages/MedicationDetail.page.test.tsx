import {
  aMedication,
  daysFromToday,
  fireEvent,
  jsonResponse,
  mockFetch,
  renderApp,
  screen,
} from '@test-utils';
import type { EssentialDetail } from '../api/essentials';
import { MedicationDetailPage } from './MedicationDetail.page';

const tafirol = aMedication({
  id: 3,
  commercial_name: 'Tafirol',
  type: 'Tablets',
  drugs: [{ dose: '500 mg', drug: { id: 1, name: 'Paracetamol' } }],
  existences: [
    { id: 1, due_date: daysFromToday(-5), low_amount: false },
    { id: 2, due_date: daysFromToday(100), low_amount: true },
  ],
});

const open = (route = '/medications/3') =>
  renderApp(<MedicationDetailPage />, { route, path: '/medications/:id' });

afterEach(() => {
  vi.useRealTimers();
});

// The medication at /api/medications/3, and these essentials at /api/essentials/.
const api = (essentials: EssentialDetail[] = []) =>
  mockFetch(({ url }) =>
    url.pathname === '/api/essentials/' ? jsonResponse(essentials) : jsonResponse(tafirol)
  );

describe('MedicationDetailPage', () => {
  it('shows the medication', async () => {
    api();
    open();

    expect(await screen.findByRole('heading', { name: 'Tafirol' })).toBeInTheDocument();
    expect(screen.getByText('Tablets')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // no function
    expect(screen.getByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('In date')).toBeInTheDocument();
    expect(screen.getByText('Running low')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      '/stock?medicamento=3'
    );
  });

  it('says when the medication doesn’t exist', async () => {
    mockFetch(() => jsonResponse({ detail: 'Medication not found' }, 404));
    open('/medications/999');

    expect(await screen.findByText('Medication not found')).toBeInTheDocument();
  });

  it.each(['/medications/abc', '/medications/0', '/medications/1.5'])(
    'doesn’t even ask for an invalid id (%s)',
    (route) => {
      const fetchMock = mockFetch(() => jsonResponse(tafirol));
      open(route);

      expect(screen.getByText('Medication not found')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('retries other errors a few times before showing them', async () => {
    // The page's own retry policy waits 1 s, 2 s, 4 s between attempts: skip the waits.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockFetch(() => jsonResponse(null, 500));
    open();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await screen.findByText('Couldn’t load the medication')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('doesn’t retry a missing medication', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ detail: 'Medication not found' }, 404));
    open();

    await screen.findByText('Medication not found');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('edits the medication', async () => {
    // A tiny backend: after the PATCH, reads return the renamed medication.
    let stored = tafirol;
    const fetchMock = mockFetch(({ method, url }) => {
      if (url.pathname === '/api/drugs/' || url.pathname === '/api/essentials/') {
        return jsonResponse([]);
      }
      if (method === 'PATCH') {
        stored = { ...stored, commercial_name: 'Tafirol Forte' };
      }
      return jsonResponse(stored);
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/Brand name/), { target: { value: 'Tafirol Forte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Back to the view, already showing the saved version.
    expect(await screen.findByRole('heading', { name: 'Tafirol Forte' })).toBeInTheDocument();
    const patch = fetchMock.requests.find(({ method }) => method === 'PATCH')!;
    expect(patch.url.pathname).toBe('/api/medications/3');
    expect(patch.body).toEqual({
      commercial_name: 'Tafirol Forte',
      type: 'Tablets',
      function: null,
      drugs: [{ name: 'Paracetamol', dose: '500 mg' }],
    });
  });

  describe('essential', () => {
    it('offers to always keep its composition', async () => {
      const fetchMock = api();
      open();

      fireEvent.click(
        await screen.findByRole('button', { name: 'Always keep Paracetamol 500 mg' })
      );

      await vi.waitFor(() =>
        expect(fetchMock.requests.find((r) => r.method === 'POST')).toMatchObject({
          url: expect.objectContaining({ pathname: '/api/essentials/' }),
          // By drug id: the composition this medication already has, not a new drug.
          body: { drugs: [{ drug_id: 1, dose: '500 mg' }] },
        })
      );
    });

    it('shows when its composition is essential, and asks before removing it', async () => {
      const fetchMock = api([{ id: 7, drugs: tafirol.drugs, medications: [tafirol] }]);
      open();

      expect(await screen.findByText('Essential')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Stop keeping' }));
      // It affects every brand with this composition, so it says so first.
      expect(await screen.findByText(/Stop keeping Paracetamol 500 mg\?/)).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole('button', { name: 'Stop keeping' }).at(-1)!);

      await vi.waitFor(() =>
        expect(fetchMock.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
          '/api/essentials/7'
        )
      );
    });

    it('can’t be essential without a composition', async () => {
      mockFetch(({ url }) =>
        jsonResponse(url.pathname === '/api/essentials/' ? [] : { ...tafirol, drugs: [] })
      );
      open();

      expect(
        await screen.findByText('Add its composition to make it essential')
      ).toBeInTheDocument();
    });
  });
});
