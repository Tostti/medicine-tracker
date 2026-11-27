import {
  act,
  aMedication,
  daysFromToday,
  jsonResponse,
  mockFetch,
  renderApp,
  screen,
  within,
} from '@test-utils';
import type { EssentialDetail } from '../../api/essentials';
import type { Existence, Medication } from '../../api/medications';
import BuyingList from './BuyingList';

const existence = (days: number, low_amount = false): Existence => ({
  id: Math.random(),
  due_date: daysFromToday(days),
  low_amount,
});

let nextId = 1;
// An essential for one drug at 600 mg ("Ibuprofeno 600 mg"), covered by these medications.
const anEssential = (drug: string, medications: Medication[] = []): EssentialDetail => {
  const id = nextId++;
  return { id, drugs: [{ dose: '600 mg', drug: { id, name: drug } }], medications };
};

function setup(essentials: EssentialDetail[]) {
  const fetchMock = mockFetch(() => jsonResponse(essentials));
  renderApp(<BuyingList />);
  return fetchMock;
}

// The badges shown next to an essential in the list.
const reasonsFor = async (label: string) => {
  const item = (await screen.findByText(label)).closest('li')!;
  return within(item)
    .queryAllByText(/^(Out of stock|Expired|Expiring soon|Running low)$/)
    .map((el) => el.textContent);
};

describe('BuyingList', () => {
  it('reads the essentials', async () => {
    const fetchMock = setup([]);

    await screen.findByText('No essentials yet');
    expect(fetchMock.requests[0].url.pathname).toBe('/api/essentials/');
  });

  it('lists an essential no brand covers', async () => {
    setup([anEssential('Ibuprofeno')]);

    expect(await reasonsFor('Ibuprofeno 600 mg')).toEqual(['Out of stock']);
  });

  it('lists what only has expired stock', async () => {
    setup([anEssential('Ibuprofeno', [aMedication({ existences: [existence(-1)] })])]);

    expect(await reasonsFor('Ibuprofeno 600 mg')).toEqual(['Expired']);
  });

  it('lists what expires within a month', async () => {
    setup([
      anEssential('Ibuprofeno', [aMedication({ existences: [existence(-10), existence(20)] })]),
    ]);

    expect(await reasonsFor('Ibuprofeno 600 mg')).toEqual(['Expiring soon']);
  });

  it('lists the last unit when it is running low', async () => {
    setup([anEssential('Ibuprofeno', [aMedication({ existences: [existence(90, true)] })])]);

    expect(await reasonsFor('Ibuprofeno 600 mg')).toEqual(['Running low']);
  });

  it('can give several reasons at once', async () => {
    setup([anEssential('Ibuprofeno', [aMedication({ existences: [existence(5, true)] })])]);

    expect(await reasonsFor('Ibuprofeno 600 mg')).toEqual(['Expiring soon', 'Running low']);
  });

  it('counts the stock of every brand together', async () => {
    setup([
      anEssential('Ibuprofeno', [
        // On its own, this one would be "expiring soon"...
        aMedication({ commercial_name: 'Ibupirac', existences: [existence(10)] }),
        // ...but this other brand lasts longer.
        aMedication({ commercial_name: 'Actron', existences: [existence(200)] }),
      ]),
      anEssential('Paracetamol', [
        // Each one alone is the last unit, running low; together they're two.
        aMedication({ existences: [existence(200, true)] }),
        aMedication({ existences: [existence(300, true)] }),
      ]),
    ]);

    expect(await screen.findByText('Nothing to buy')).toBeInTheDocument();
  });

  describe('names', () => {
    // [title, subtitle] of the only item in the list.
    const labels = async () => {
      const item = await screen.findByRole('listitem');
      return within(item)
        .getAllByText(/.+/, { selector: 'p' })
        .map((el) => el.textContent);
    };
    const expired = (commercial_name: string) =>
      aMedication({ commercial_name, existences: [existence(-1)] });

    it('uses the composition when no brand covers it', async () => {
      setup([anEssential('Ibuprofeno')]);

      expect(await labels()).toEqual(['Ibuprofeno 600 mg']);
    });

    it('puts the brand on top, and the composition below', async () => {
      setup([anEssential('Hioscina', [expired('Buscapina compositum')])]);

      expect(await labels()).toEqual(['Buscapina compositum', 'Hioscina 600 mg']);
    });

    it('names up to two brands', async () => {
      setup([anEssential('Ibuprofeno', [expired('Actron 600'), expired('Ibupirac 600')])]);

      expect(await labels()).toEqual(['Actron 600, Ibupirac 600', 'Ibuprofeno 600 mg']);
    });

    it('counts the rest of the brands', async () => {
      setup([
        anEssential('Ibuprofeno', [
          expired('Actron 600'),
          expired('Ibupirac 600'),
          expired('Ibuevanol 600'),
          expired('Febratic 600'),
        ]),
      ]);

      expect(await labels()).toEqual(['Actron 600, Ibupirac 600 and 2 more', 'Ibuprofeno 600 mg']);
    });
  });

  it('says when there is nothing to buy', async () => {
    setup([anEssential('Ibuprofeno', [aMedication({ existences: [existence(200)] })])]);

    expect(await screen.findByText('Nothing to buy')).toBeInTheDocument();
  });

  it('links to the essentials', async () => {
    setup([]);

    expect(await screen.findByRole('link', { name: 'Essentials' })).toHaveAttribute(
      'href',
      '/essentials'
    );
  });

  it('shows the error when loading fails', async () => {
    mockFetch(() => jsonResponse(null, 500));
    renderApp(<BuyingList />);

    expect(await screen.findByText('Couldn’t load the essentials')).toBeInTheDocument();
  });

  it('keeps showing the loaded list when a refetch can’t reach the server', async () => {
    let serverUp = true;
    mockFetch(() => {
      if (!serverUp) {
        throw new TypeError('Failed to fetch');
      }
      return jsonResponse([anEssential('Ibuprofeno')]);
    });
    const { queryClient } = renderApp(<BuyingList />);
    await screen.findByText('Ibuprofeno 600 mg');

    serverUp = false;
    // TanStack notifies components on a timer, so wait one tick for the re-render too.
    await act(async () => {
      await queryClient.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(queryClient.getQueryState(['medications', 'essentials'])?.status).toBe('error');
    expect(screen.getByText('Ibuprofeno 600 mg')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
