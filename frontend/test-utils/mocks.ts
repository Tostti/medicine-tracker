import { type Medication, toISODate } from '../src/api/medications';

// A date relative to today, as "YYYY-MM-DD" (negative = in the past).
export const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

let nextId = 1;

// A medication as the API returns it; override only what the test cares about.
export const aMedication = (overrides: Partial<Medication> = {}): Medication => {
  const id = overrides.id ?? nextId++;
  return {
    id,
    commercial_name: `Medication ${id}`,
    type: null,
    function: null,
    picture_uri: null,
    drugs: [],
    existences: [],
    ...overrides,
  };
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

interface FetchRequest {
  method: string;
  url: URL; // absolute, so pathname and searchParams are easy to check
  body: unknown; // parsed JSON, or the FormData as sent
}

/**
 * Replaces the global fetch with `handler`, which answers each request.
 * Returns the mock: `.mock.calls` has the raw arguments and `.requests` the parsed ones.
 * The real fetch is restored after each test (`unstubGlobals` in vite.config.mjs).
 */
export const mockFetch = (handler: (request: FetchRequest) => Response | Promise<Response>) => {
  const requests: FetchRequest[] = [];
  // The app only ever calls fetch with a string or a URL.
  const fetchMock = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const request = {
      method: init.method ?? 'GET',
      url: new URL(input, window.location.origin),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    };
    requests.push(request);
    return handler(request);
  });
  vi.stubGlobal('fetch', fetchMock);
  return Object.assign(fetchMock, { requests });
};
