import { aMedication, fireEvent, jsonResponse, mockFetch, renderApp, screen } from '@test-utils';
import { NewMedicationPage } from './NewMedication.page';

const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function setup(route = '/medications/new') {
  const fetchMock = mockFetch(({ method, url }) => {
    if (url.pathname === '/api/drugs/') {
      return jsonResponse([]);
    }
    if (method === 'POST' && url.pathname === '/api/images/') {
      return jsonResponse({ key: 'medications/abc.webp' }, 201);
    }
    if (method === 'POST' && url.pathname === '/api/medications/') {
      return jsonResponse(aMedication({ id: 42 }), 201);
    }
    return jsonResponse({ detail: 'unexpected request' }, 500);
  });
  const view = renderApp(<NewMedicationPage />, { route, path: '/medications/new' });
  return { ...view, fetchMock };
}

const posts = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.requests
    .filter(({ method }) => method === 'POST')
    .map(({ url, body }) => ({ url: url.pathname, body }));

describe('NewMedicationPage', () => {
  it('prefills the name from the search', () => {
    setup('/medications/new?nombre=Tafirol%20forte');

    expect(screen.getByLabelText(/Brand name/)).toHaveValue('Tafirol forte');
  });

  it('creates the medication and opens it', async () => {
    const { fetchMock, router } = setup();

    fill(/Brand name/, 'Tafirol');
    fill('Type', 'Tablets');
    fireEvent.change(screen.getAllByRole('combobox', { name: 'Drug' })[0], {
      target: { value: 'Paracetamol' },
    });
    fill('Dose', '500 mg');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/medications/42'));
    expect(posts(fetchMock)).toEqual([
      {
        url: '/api/medications/',
        body: {
          commercial_name: 'Tafirol',
          type: 'Tablets',
          function: null, // empty fields are sent as null
          common_use: false,
          picture_uri: null,
          drugs: [{ name: 'Paracetamol', dose: '500 mg' }],
          existences: [],
        },
      },
    ]);
    // Replaced, so "back" doesn't return to an empty form.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('uploads the picture first and creates the medication with its key', async () => {
    const { fetchMock, router } = setup();
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });

    fill(/Brand name/, 'Tafirol');
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/medications/42'));
    const [upload, create] = posts(fetchMock);
    expect(upload.url).toBe('/api/images/');
    expect((upload.body as FormData).get('file')).toBe(file);
    expect(create.body).toMatchObject({ picture_uri: 'medications/abc.webp' });
  });

  it('goes back to the list on cancel', () => {
    const { router } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(router.state.location.pathname).toBe('/medications');
  });
});
