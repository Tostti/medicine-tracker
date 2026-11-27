import i18n from '../i18n';
import type { Medication, MedicationDrug, MedicationDrugCreate } from './medications';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * A composition to always keep at home, whatever the brand: "Ibuprofeno 600 mg".
 * Any medication with exactly the same drugs and doses covers it (the backend compares
 * doses, so "1 g" covers "1000 mg").
 */
export interface Essential {
  id: number;
  drugs: MedicationDrug[];
}

export interface EssentialDetail extends Essential {
  // The medications that cover it, with their stock.
  medications: Medication[];
}

// Under 'medications' on purpose: everything that changes a medication or its stock
// already invalidates that prefix, and each of those changes can change what covers what.
export const essentialsQueryKey = ['medications', 'essentials'] as const;

const errorDetail = async (response: Response, fallback: string): Promise<string> => {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === 'string' ? body.detail : fallback;
};

export const fetchEssentials = async (): Promise<EssentialDetail[]> => {
  const response = await fetch(`${API_URL}/essentials/`);
  if (!response.ok) {
    throw new Error(i18n.t('api.fetchEssentials'));
  }
  return response.json();
};

export const createEssential = async (drugs: MedicationDrugCreate[]): Promise<Essential> => {
  const response = await fetch(`${API_URL}/essentials/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drugs }),
  });
  // The backend's English detail is replaced by a translated one.
  if (response.status === 409) {
    throw new Error(i18n.t('api.duplicateEssential'));
  }
  if (!response.ok) {
    throw new Error(await errorDetail(response, i18n.t('api.createEssential')));
  }
  return response.json();
};

export const deleteEssential = async (id: number): Promise<void> => {
  const response = await fetch(`${API_URL}/essentials/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(i18n.t('api.deleteEssential'));
  }
};

// "Paracetamol 500 mg + Cafeína 65 mg"
export const compositionLabel = (drugs: MedicationDrug[]) =>
  drugs.map((d) => `${d.drug.name} ${d.dose}`).join(' + ');

// The essential a medication covers, if any (at most one: compositions are unique).
export const essentialOf = (essentials: EssentialDetail[], medicationId: number) =>
  essentials.find((e) => e.medications.some((m) => m.id === medicationId));
