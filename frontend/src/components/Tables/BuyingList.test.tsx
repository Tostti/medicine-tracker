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
import BuyingList from './BuyingList';

const existence = (days: number, low_amount = false) => ({
  id: Math.random(),
  due_date: daysFromToday(days),
  low_amount,
});

function setup(medications: Medication[]) {
  const fetchMock = mockFetch(() => jsonResponse(medications));
  renderApp(<BuyingList />);
  return fetchMock;
}

// The badges shown next to a medication in the list.
const reasonsFor = async (name: string) => {
  const item = (await screen.findByText(name)).closest('li')!;
  return within(item)
    .queryAllByText(/.+/)
    .map((el) => el.textContent)
    .filter((text) => text !== name);
};

describe('BuyingList', () => {
  it('only asks for common-use medications', async () => {
    const fetchMock = setup([]);

    await screen.findByText('Nothing to buy');
    expect(fetchMock.requests[0].url.searchParams.get('common_use')).toBe('true');
  });

  it('lists what has no stock at all', async () => {
    setup([aMedication({ commercial_name: 'Tafirol' })]);

    expect(await reasonsFor('Tafirol')).toEqual(['Out of stock']);
  });

  it('lists what only has expired stock', async () => {
    setup([aMedication({ commercial_name: 'Tafirol', existences: [existence(-1)] })]);

    expect(await reasonsFor('Tafirol')).toEqual(['Expired']);
  });

  it('lists what expires within a month', async () => {
    setup([
      aMedication({ commercial_name: 'Tafirol', existences: [existence(-10), existence(20)] }),
    ]);

    expect(await reasonsFor('Tafirol')).toEqual(['Expiring soon']);
  });

  it('lists the last unit when it is running low', async () => {
    setup([aMedication({ commercial_name: 'Tafirol', existences: [existence(90, true)] })]);

    expect(await reasonsFor('Tafirol')).toEqual(['Running low']);
  });

  it('can give several reasons at once', async () => {
    setup([aMedication({ commercial_name: 'Tafirol', existences: [existence(5, true)] })]);

    expect(await reasonsFor('Tafirol')).toEqual(['Expiring soon', 'Running low']);
  });

  it('leaves out what is well stocked', async () => {
    setup([
      aMedication({ commercial_name: 'Fine', existences: [existence(200)] }),
      // Running low, but there's another valid unit.
      aMedication({ commercial_name: 'Spare', existences: [existence(200, true), existence(300)] }),
      // One unit expires soon, but another lasts longer.
      aMedication({ commercial_name: 'Later', existences: [existence(10), existence(200)] }),
      aMedication({ commercial_name: 'Missing' }),
    ]);

    await screen.findByText('Missing');
    expect(screen.queryByText('Fine')).not.toBeInTheDocument();
    expect(screen.queryByText('Spare')).not.toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });

  it('says when there is nothing to buy', async () => {
    setup([aMedication({ existences: [existence(200)] })]);

    expect(await screen.findByText('Nothing to buy')).toBeInTheDocument();
  });

  it('shows the error when loading fails', async () => {
    mockFetch(() => jsonResponse(null, 500));
    renderApp(<BuyingList />);

    expect(await screen.findByText('Couldn’t load the medications')).toBeInTheDocument();
  });
});
