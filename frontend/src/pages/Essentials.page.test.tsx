import { aMedication, fireEvent, jsonResponse, mockFetch, renderApp, screen } from '@test-utils';
import type { EssentialDetail } from '../api/essentials';
import { EssentialsPage } from './Essentials.page';

const ibuprofeno: EssentialDetail = {
  id: 7,
  drugs: [{ dose: '600 mg', drug: { id: 1, name: 'Ibuprofeno' } }],
  medications: [aMedication({ id: 3, commercial_name: 'Ibupirac 600' })],
};
const paracetamol: EssentialDetail = {
  id: 8,
  drugs: [{ dose: '1 g', drug: { id: 2, name: 'Paracetamol' } }],
  medications: [],
};

// GET /essentials/ answers with `essentials`; POST answers with `onPost` (default 201).
function setup(essentials: EssentialDetail[], onPost = () => jsonResponse(ibuprofeno, 201)) {
  const fetchMock = mockFetch(({ method, url }) => {
    if (url.pathname === '/api/drugs/') {
      return jsonResponse([{ id: 1, name: 'Ibuprofeno' }]);
    }
    if (method === 'POST') {
      return onPost();
    }
    if (method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return jsonResponse(essentials);
  });
  renderApp(<EssentialsPage />, { route: '/essentials' });
  return fetchMock;
}

const posted = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.requests.filter((r) => r.method === 'POST').map((r) => r.body);

describe('EssentialsPage', () => {
  it('lists each essential with the brands that cover it', async () => {
    setup([ibuprofeno, paracetamol]);

    expect(await screen.findByText('Ibuprofeno 600 mg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ibupirac 600' })).toHaveAttribute(
      'href',
      '/medications/3'
    );
    expect(screen.getByText('Paracetamol 1 g')).toBeInTheDocument();
    expect(screen.getByText('No brand at home yet')).toBeInTheDocument();
  });

  it('adds an essential, even with no brand at home', async () => {
    const fetchMock = setup([]);
    await screen.findByText('No essentials yet');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Drug' }), {
      target: { value: ' Ibuprofeno ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Dose' }), {
      target: { value: '600 mg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(posted(fetchMock)).toEqual([{ drugs: [{ name: 'Ibuprofeno', dose: '600 mg' }] }])
    );
  });

  it('adds a combination', async () => {
    const fetchMock = setup([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));

    const drugs = screen.getAllByRole('combobox', { name: 'Drug' });
    const doses = screen.getAllByRole('textbox', { name: 'Dose' });
    fireEvent.change(drugs[0], { target: { value: 'Paracetamol' } });
    fireEvent.change(doses[0], { target: { value: '500 mg' } });
    fireEvent.change(drugs[1], { target: { value: 'Cafeína' } });
    fireEvent.change(doses[1], { target: { value: '65 mg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() =>
      expect(posted(fetchMock)).toEqual([
        {
          drugs: [
            { name: 'Paracetamol', dose: '500 mg' },
            { name: 'Cafeína', dose: '65 mg' },
          ],
        },
      ])
    );
  });

  it('needs a drug and a dose', async () => {
    const fetchMock = setup([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Drug required')).toBeInTheDocument();
    expect(screen.getByText('Dose required')).toBeInTheDocument();
    expect(posted(fetchMock)).toEqual([]);
  });

  it('says when the composition is already essential', async () => {
    setup([], () => jsonResponse({ detail: 'duplicate' }, 409));
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Drug' }), {
      target: { value: 'Ibuprofeno' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Dose' }), {
      target: { value: '0,6 g' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('That composition is already an essential')).toBeInTheDocument();
  });

  it('asks before removing one', async () => {
    const fetchMock = setup([ibuprofeno]);

    fireEvent.click(await screen.findByRole('button', { name: 'Stop keeping Ibuprofeno 600 mg' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stop keeping' }));

    await vi.waitFor(() =>
      expect(fetchMock.requests.find((r) => r.method === 'DELETE')?.url.pathname).toBe(
        '/api/essentials/7'
      )
    );
  });
});
