import i18n from '../i18n';

// Relative by default: the same server that serves the page proxies /api to the backend,
// so this works from any device without knowing the host.
const API_URL = import.meta.env.VITE_API_URL ?? '/api';

// 422s from our own checks have a string detail; pydantic validation errors have a list.
const errorDetail = async (response: Response, fallback: string): Promise<string> => {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === 'string' ? body.detail : fallback;
};

export interface Existence {
  id: number;
  due_date: string; // "YYYY-MM-DD"
  low_amount: boolean;
}

export interface Drug {
  id: number;
  name: string;
}

export interface MedicationDrug {
  dose: string;
  drug: Drug;
}

export interface MedicationFilters {
  q?: string;
  common_use?: boolean;
  skip?: number;
  limit?: number;
}

export interface Medication {
  id: number;
  commercial_name: string;
  type: string | null;
  function: string | null;
  picture_uri: string | null;
  common_use: boolean;
  drugs: MedicationDrug[];
  existences: Existence[];
}

export const fetchMedications = async (filters: MedicationFilters = {}): Promise<Medication[]> => {
  // new URL() needs a base when API_URL is relative like '/api'.
  const url = new URL(`${API_URL}/medications/`, window.location.origin);
  if (filters.q) {
    url.searchParams.set('q', filters.q);
  }
  if (filters.common_use !== undefined) {
    url.searchParams.set('common_use', String(filters.common_use));
  }
  if (filters.skip !== undefined) {
    url.searchParams.set('skip', String(filters.skip));
  }
  if (filters.limit !== undefined) {
    url.searchParams.set('limit', String(filters.limit));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(i18n.t('api.fetchMedications'));
  }
  return response.json();
};

export class NotFoundError extends Error {}

export const fetchMedication = async (id: number): Promise<Medication> => {
  const response = await fetch(`${API_URL}/medications/${id}`);
  if (response.status === 404) {
    throw new NotFoundError(i18n.t('api.medicationNotFound'));
  }
  if (!response.ok) {
    throw new Error(i18n.t('api.fetchMedication'));
  }
  return response.json();
};

// Every known drug, for suggestions while typing (a household has a few dozen at most).
export const fetchDrugs = async (): Promise<Drug[]> => {
  const response = await fetch(`${API_URL}/drugs/?limit=1000`);
  if (!response.ok) {
    throw new Error(i18n.t('api.fetchDrugs'));
  }
  return response.json();
};

// A drug for a new medication: an existing one by id, or by name
// (the backend reuses a drug with that name, ignoring case, or creates it).
export type MedicationDrugCreate =
  | { drug_id: number; dose: string }
  | { name: string; dose: string };

export interface MedicationCreate {
  commercial_name: string;
  type?: string | null;
  function?: string | null;
  picture_uri?: string | null;
  common_use?: boolean;
  drugs: MedicationDrugCreate[];
  existences?: Omit<Existence, 'id'>[];
}

// PATCH: only the fields sent change. `drugs`, if sent, replaces the whole list.
export type MedicationUpdate = Partial<Omit<MedicationCreate, 'existences'>>;

export const updateMedication = async (
  id: number,
  payload: MedicationUpdate
): Promise<Medication> => {
  const response = await fetch(`${API_URL}/medications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.updateMedication')));
  }
  return response.json();
};

export const createMedication = async (payload: MedicationCreate): Promise<Medication> => {
  const response = await fetch(`${API_URL}/medications/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.createMedication')));
  }
  return response.json();
};

// picture_uri is either an external URL (kept as is) or a key from our storage,
// served by the backend at /images/{key}.
export const pictureSrc = (pictureUri: string | null): string | null => {
  if (!pictureUri) {
    return null;
  }
  if (/^https?:\/\//.test(pictureUri)) {
    return pictureUri;
  }
  return `${API_URL}/images/${pictureUri}`;
};

// Upload before creating a medication: send the returned key as picture_uri.
export const uploadImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append('file', file);
  // No Content-Type header: the browser sets multipart/form-data with its boundary.
  const response = await fetch(`${API_URL}/images/`, { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.uploadImage')));
  }
  const { key } = (await response.json()) as { key: string };
  return key;
};

// Replace the picture of an existing medication (the old uploaded one is deleted).
export const setMedicationPicture = async (id: number, file: File): Promise<Medication> => {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_URL}/medications/${id}/picture`, {
    method: 'PUT',
    body: form,
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.updatePicture')));
  }
  return response.json();
};

// Local date as "YYYY-MM-DD", the same format as due_date, so they compare as strings.
export const toISODate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// --- Stock (existences) ---

export const addExistence = async (
  medicationId: number,
  payload: Omit<Existence, 'id'>
): Promise<Existence> => {
  const response = await fetch(`${API_URL}/medications/${medicationId}/existences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.addStock')));
  }
  return response.json();
};

export const updateExistence = async (
  id: number,
  payload: Partial<Omit<Existence, 'id'>>
): Promise<Existence> => {
  const response = await fetch(`${API_URL}/existences/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.updateStock')));
  }
  return response.json();
};

export const deleteExistence = async (id: number): Promise<void> => {
  const response = await fetch(`${API_URL}/existences/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.discard')));
  }
};
