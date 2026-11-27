import {
  aMedication,
  daysFromToday,
  jsonResponse,
  mockFetch,
  renderApp,
  screen,
  within,
} from '@test-utils';
import type { Medication } from '../../api/medications';
import { formatDate } from '../../i18n';
import { ExpiredList, NextExpirations } from './Expirations';

let nextId = 1;
const existence = (days: number) => ({
  id: nextId++,
  due_date: daysFromToday(days),
  low_amount: false,
});

// The table's body rows, as [medication, date, badge] texts.
const rows = async () => {
  const table = await screen.findByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1) // header
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    );
};

function setup(ui: React.ReactNode, medications: Medication[]) {
  mockFetch(() => jsonResponse(medications));
  renderApp(ui);
}

describe('NextExpirations', () => {
  it('lists upcoming expirations of every medication, soonest first', async () => {
    setup(<NextExpirations />, [
      aMedication({ commercial_name: 'Tafirol', existences: [existence(40), existence(-3)] }),
      aMedication({ commercial_name: 'Ibupirac', existences: [existence(0), existence(6)] }),
    ]);

    expect(await rows()).toEqual([
      ['Ibupirac', formatDate(daysFromToday(0)), 'today'],
      ['Ibupirac', formatDate(daysFromToday(6)), '6 days'],
      ['Tafirol', formatDate(daysFromToday(40)), '40 days'],
    ]);
  });

  it('shows at most five', async () => {
    setup(<NextExpirations />, [aMedication({ existences: [1, 2, 3, 4, 5, 6, 7].map(existence) })]);

    expect((await rows()).map(([, , left]) => left)).toEqual([
      '1 day',
      '2 days',
      '3 days',
      '4 days',
      '5 days',
    ]);
  });

  it('says when nothing is about to expire', async () => {
    setup(<NextExpirations />, [aMedication({ existences: [existence(-1)] })]);

    expect(await screen.findByText('Nothing about to expire')).toBeInTheDocument();
  });
});

describe('ExpiredList', () => {
  it('lists every expired unit, oldest first', async () => {
    setup(<ExpiredList />, [
      aMedication({ commercial_name: 'Tafirol', existences: [existence(-1), existence(10)] }),
      aMedication({ commercial_name: 'Ibupirac', existences: [existence(-30)] }),
    ]);

    expect(await rows()).toEqual([
      ['Ibupirac', formatDate(daysFromToday(-30)), '30 days ago'],
      ['Tafirol', formatDate(daysFromToday(-1)), '1 day ago'],
    ]);
  });

  it('says when nothing has expired', async () => {
    setup(<ExpiredList />, [aMedication({ existences: [existence(0)] })]);

    expect(await screen.findByText('Nothing expired')).toBeInTheDocument();
  });

  it('shows the error when loading fails', async () => {
    mockFetch(() => jsonResponse(null, 500));
    renderApp(<ExpiredList />);

    expect(await screen.findByText('Couldn’t load the medications')).toBeInTheDocument();
  });
});

describe('links to the stock page', () => {
  it('sends the expired list to the stock page filtered by expired', async () => {
    setup(<ExpiredList />, [aMedication({ existences: [existence(-3)] })]);
    const link = await screen.findByRole('link', { name: 'Review and throw away' });
    expect(link).toHaveAttribute('href', '/stock?estado=vencidos');
  });

  it('sends the upcoming list to all stock, by expiration', async () => {
    setup(<NextExpirations />, [aMedication({ existences: [existence(3)] })]);
    const link = await screen.findByRole('link', { name: 'See all by expiration' });
    expect(link).toHaveAttribute('href', '/stock?orden=vencimiento');
  });

  it('has no link when there is nothing to list', async () => {
    setup(<ExpiredList />, [aMedication({ existences: [existence(3)] })]);
    await screen.findByText('Nothing expired');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
