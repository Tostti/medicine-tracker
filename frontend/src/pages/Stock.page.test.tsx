import {
  aMedication,
  daysFromToday,
  fireEvent,
  jsonResponse,
  mockFetch,
  renderApp,
  screen,
} from '@test-utils';
import { formatDate } from '../i18n';
import { StockPage } from './Stock.page';

let nextId = 1;
const existence = (days: number) => ({
  id: nextId++,
  due_date: daysFromToday(days),
  low_amount: false,
});

function setup(route = '/stock') {
  mockFetch(() =>
    jsonResponse([
      aMedication({ commercial_name: 'Tafirol', existences: [existence(-3), existence(60)] }),
      aMedication({ commercial_name: 'Aspirina', existences: [existence(90)] }),
    ])
  );
  return renderApp(<StockPage />, { route, path: '/stock' });
}

// The medication names of the cards shown, in order.
const cardNames = () => screen.queryAllByRole('link').map((a) => a.textContent);

describe('StockPage filters', () => {
  it('shows all stock by name when the URL has no filters', async () => {
    setup();
    await screen.findByRole('link', { name: 'Tafirol' });
    expect(cardNames()).toEqual(['Aspirina', 'Tafirol']);
  });

  it('opens already filtered from ?estado=vencidos, with only the expired lots', async () => {
    setup('/stock?estado=vencidos');
    await screen.findByRole('link', { name: 'Tafirol' });

    expect(cardNames()).toEqual(['Tafirol']);
    expect(screen.getByText(formatDate(daysFromToday(-3)))).toBeInTheDocument();
    expect(screen.queryByText(formatDate(daysFromToday(60)))).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Expired' })).toBeChecked();
  });

  it('keeps the filters in the URL as they change', async () => {
    const { router } = setup();
    await screen.findByRole('link', { name: 'Tafirol' });

    fireEvent.click(screen.getByRole('radio', { name: 'Expired' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter by name' }), {
      target: { value: 'taf' },
    });

    expect(router.state.location.search).toBe('?estado=vencidos&buscar=taf');
    expect(cardNames()).toEqual(['Tafirol']);
  });

  it('offers to clear the filters when nothing matches', async () => {
    const { router } = setup('/stock?buscar=nothing');
    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters' }));

    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('link', { name: 'Tafirol' })).toBeInTheDocument();
  });
});
