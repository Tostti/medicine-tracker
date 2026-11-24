import {
  aMedication,
  daysFromToday,
  fireEvent,
  jsonResponse,
  mockFetch,
  renderApp,
  screen,
} from '@test-utils';
import type { Medication } from '../../api/medications';
import { formatDate } from '../../i18n';
import { MedicationStockCard } from './MedicationStockCard';

const IN_A_YEAR = daysFromToday(365);

const medication = (overrides: Partial<Medication> = {}) =>
  aMedication({
    id: 3,
    commercial_name: 'Tafirol',
    existences: [{ id: 10, due_date: IN_A_YEAR, low_amount: false }],
    ...overrides,
  });

// Answers every write with a plausible body, and the refetch of the medication list.
function setup(med: Medication) {
  const fetchMock = mockFetch(({ method }) =>
    method === 'DELETE'
      ? new Response(null, { status: 204 })
      : jsonResponse({ id: 10, due_date: IN_A_YEAR, low_amount: false })
  );
  const view = renderApp(<MedicationStockCard medication={med} />);
  const invalidate = vi.spyOn(view.queryClient, 'invalidateQueries');
  return { fetchMock, invalidate };
}

const writes = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.requests.map(({ method, url, body }) => ({
    request: `${method} ${url.pathname}`,
    body,
  }));

describe('MedicationStockCard', () => {
  it('links to the medication', () => {
    setup(medication());

    expect(screen.getByRole('link', { name: 'Tafirol' })).toHaveAttribute('href', '/medications/3');
  });

  it.each([
    [-1, 'Expired'],
    [10, 'Expiring soon'],
    [365, 'In date'],
  ])('a unit due in %i days is “%s”', (days, label) => {
    setup(
      medication({ existences: [{ id: 10, due_date: daysFromToday(days), low_amount: false }] })
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('says when there is no stock', () => {
    setup(medication({ existences: [] }));

    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('adds stock', async () => {
    const { fetchMock, invalidate } = setup(medication({ existences: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2027-05-31' } });
    fireEvent.click(screen.getByLabelText('Running low'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The form closes once the lists are refreshed.
    await vi.waitFor(() =>
      expect(screen.queryByLabelText('Expiration date')).not.toBeInTheDocument()
    );
    expect(writes(fetchMock)).toEqual([
      {
        request: 'POST /api/medications/3/existences',
        body: { due_date: '2027-05-31', low_amount: true },
      },
    ]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['medications'] });
  });

  it('needs a date to add stock', () => {
    const { fetchMock } = setup(medication({ existences: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Date required')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows why adding stock failed', async () => {
    mockFetch(() => jsonResponse({ detail: 'Medication not found' }, 404));
    renderApp(<MedicationStockCard medication={medication({ existences: [] })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: '2027-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Medication not found')).toBeInTheDocument();
  });

  it('marks a unit as running low', async () => {
    const { fetchMock } = setup(medication());

    fireEvent.click(screen.getByRole('switch', { name: 'Running low' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(writes(fetchMock)).toEqual([
      { request: 'PATCH /api/existences/10', body: { low_amount: true } },
    ]);
  });

  it('throws a unit away only after confirming', async () => {
    const { fetchMock } = setup(medication());
    const date = formatDate(IN_A_YEAR);

    fireEvent.click(screen.getByRole('button', { name: `Throw away the one expiring on ${date}` }));
    expect(await screen.findByText(`Throw away the one expiring on ${date}?`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Throw away' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(writes(fetchMock)).toEqual([{ request: 'DELETE /api/existences/10', body: undefined }]);
  });

  it('fixes a due date', async () => {
    const { fetchMock } = setup(medication());

    fireEvent.click(screen.getByRole('button', { name: `Fix the date ${formatDate(IN_A_YEAR)}` }));
    fireEvent.change(screen.getByLabelText('New expiration date'), {
      target: { value: '2028-01-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(writes(fetchMock)).toEqual([
      { request: 'PATCH /api/existences/10', body: { due_date: '2028-01-31' } },
    ]);
  });

  it('saving an unchanged date sends nothing', () => {
    const { fetchMock } = setup(medication());

    fireEvent.click(screen.getByRole('button', { name: `Fix the date ${formatDate(IN_A_YEAR)}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByLabelText('New expiration date')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Escape cancels fixing a date', () => {
    setup(medication());

    fireEvent.click(screen.getByRole('button', { name: `Fix the date ${formatDate(IN_A_YEAR)}` }));
    fireEvent.keyDown(screen.getByLabelText('New expiration date'), { key: 'Escape' });

    expect(screen.queryByLabelText('New expiration date')).not.toBeInTheDocument();
  });
});
