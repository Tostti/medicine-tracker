import { aMedication, jsonResponse, mockFetch } from '@test-utils';
import {
  addExistence,
  createMedication,
  deleteExistence,
  fetchDrugs,
  fetchMedication,
  fetchMedications,
  NotFoundError,
  pictureSrc,
  setMedicationPicture,
  toISODate,
  updateExistence,
  updateMedication,
  uploadImage,
} from './medications';

describe('fetchMedications', () => {
  it('sends only the filters that are set', async () => {
    const fetchMock = mockFetch(() => jsonResponse([]));

    await fetchMedications();
    await fetchMedications({ q: 'ibu prof', common_use: false, skip: 0, limit: 20 });

    const [all, filtered] = fetchMock.requests.map((r) => r.url);
    expect(all.pathname).toBe('/api/medications/');
    expect(all.search).toBe('');
    expect(Object.fromEntries(filtered.searchParams)).toEqual({
      q: 'ibu prof',
      common_use: 'false',
      skip: '0',
      limit: '20',
    });
  });

  it('skips an empty search term', async () => {
    const fetchMock = mockFetch(() => jsonResponse([]));

    await fetchMedications({ q: '' });

    expect(fetchMock.requests[0].url.searchParams.has('q')).toBe(false);
  });

  it('returns the medications', async () => {
    const meds = [aMedication(), aMedication()];
    mockFetch(() => jsonResponse(meds));

    await expect(fetchMedications()).resolves.toEqual(meds);
  });

  it('throws a translated error when the server fails', async () => {
    mockFetch(() => jsonResponse({ detail: 'boom' }, 500));

    await expect(fetchMedications()).rejects.toThrow('Couldn’t load the medications');
  });
});

describe('fetchMedication', () => {
  it('throws NotFoundError on a 404', async () => {
    mockFetch(() => jsonResponse({ detail: 'Medication not found' }, 404));

    const error = await fetchMedication(7).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('throws a plain error on other failures', async () => {
    mockFetch(() => jsonResponse(null, 500));

    const error = await fetchMedication(7).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error).toEqual(new Error('Couldn’t load the medication'));
  });
});

describe('fetchDrugs', () => {
  it('asks for every drug at once', async () => {
    const fetchMock = mockFetch(() => jsonResponse([{ id: 1, name: 'Ibuprofeno' }]));

    await expect(fetchDrugs()).resolves.toEqual([{ id: 1, name: 'Ibuprofeno' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/drugs/?limit=1000');
  });
});

describe('writes', () => {
  it('createMedication POSTs the payload as JSON', async () => {
    const created = aMedication({ commercial_name: 'Tafirol' });
    const fetchMock = mockFetch(() => jsonResponse(created, 201));
    const payload = { commercial_name: 'Tafirol', drugs: [{ name: 'Paracetamol', dose: '1 g' }] };

    await expect(createMedication(payload)).resolves.toEqual(created);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/medications/');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(init!.body as string)).toEqual(payload);
  });

  it('shows the backend’s own message for its checks (string detail)', async () => {
    mockFetch(() => jsonResponse({ detail: 'Drug 9 not found' }, 422));

    await expect(createMedication({ commercial_name: 'X', drugs: [] })).rejects.toThrow(
      'Drug 9 not found'
    );
  });

  it('falls back to a generic message for validation errors (list detail)', async () => {
    mockFetch(() => jsonResponse({ detail: [{ loc: ['body'], msg: 'Field required' }] }, 422));

    await expect(createMedication({ commercial_name: 'X', drugs: [] })).rejects.toThrow(
      'Couldn’t create the medication'
    );
  });

  it('falls back to a generic message when the body isn’t JSON', async () => {
    mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(updateMedication(1, { commercial_name: 'X' })).rejects.toThrow(
      'Couldn’t update the medication'
    );
  });

  it('updateMedication PATCHes the medication', async () => {
    const fetchMock = mockFetch(() => jsonResponse(aMedication({ id: 3 })));

    await updateMedication(3, { common_use: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/medications/3',
      expect.objectContaining({ method: 'PATCH', body: '{"common_use":true}' })
    );
  });

  it('stock: add, update and delete an existence', async () => {
    const fetchMock = mockFetch(({ method }) =>
      method === 'DELETE'
        ? new Response(null, { status: 204 })
        : jsonResponse({ id: 5, due_date: '2027-01-31', low_amount: false })
    );

    await addExistence(3, { due_date: '2027-01-31', low_amount: false });
    await updateExistence(5, { low_amount: true });
    await deleteExistence(5);

    expect(fetchMock.requests.map(({ method, url }) => `${method} ${url.pathname}`)).toEqual([
      'POST /api/medications/3/existences',
      'PATCH /api/existences/5',
      'DELETE /api/existences/5',
    ]);
  });

  it('deleteExistence reports failures', async () => {
    mockFetch(() => jsonResponse({ detail: 'Existence not found' }, 404));

    await expect(deleteExistence(5)).rejects.toThrow('Existence not found');
  });
});

describe('pictures', () => {
  const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });

  it('uploadImage sends the file as form data and returns the key', async () => {
    const fetchMock = mockFetch(() => jsonResponse({ key: 'medications/abc.webp' }, 201));

    await expect(uploadImage(file)).resolves.toBe('medications/abc.webp');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/images/');
    expect(init?.method).toBe('POST');
    expect((init?.body as FormData).get('file')).toBe(file);
    // The browser must set the multipart boundary itself.
    expect(init?.headers).toBeUndefined();
  });

  it('uploadImage reports the backend’s reason', async () => {
    mockFetch(() => jsonResponse({ detail: 'Image larger than 15 MB' }, 413));

    await expect(uploadImage(file)).rejects.toThrow('Image larger than 15 MB');
  });

  it('setMedicationPicture PUTs the file', async () => {
    const fetchMock = mockFetch(() => jsonResponse(aMedication({ id: 3 })));

    await setMedicationPicture(3, file);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/medications/3/picture',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it.each([
    [null, null],
    ['', null],
    ['https://example.com/a.jpg', 'https://example.com/a.jpg'],
    ['http://example.com/a.jpg', 'http://example.com/a.jpg'],
    ['medications/abc.webp', '/api/images/medications/abc.webp'],
  ])('pictureSrc(%j) is %j', (uri, expected) => {
    expect(pictureSrc(uri)).toBe(expected);
  });
});

describe('toISODate', () => {
  it('formats the local date with zero padding', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
