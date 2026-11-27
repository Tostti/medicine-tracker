import { type Existence, type Medication, toISODate } from '../../api/medications';

const oneMonthFromToday = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
};

// Dates are "YYYY-MM-DD" strings, so they compare correctly as text.
export const isExpired = (dueDate: string) => dueDate < toISODate(new Date());

// Same thresholds as the buying list: within a month counts as "expiring soon".
export const isExpiringSoon = (dueDate: string) =>
  !isExpired(dueDate) && dueDate <= oneMonthFromToday();

export type StockStatus = 'all' | 'expired' | 'expiringSoon' | 'lowAmount';
export type StockSort = 'name' | 'expiry';

export interface StockFilters {
  status: StockStatus;
  search: string;
  sort: StockSort;
}

const statusMatches: Record<StockStatus, (e: Existence) => boolean> = {
  all: () => true,
  expired: (e) => isExpired(e.due_date),
  expiringSoon: (e) => isExpiringSoon(e.due_date),
  lowAmount: (e) => e.low_amount,
};

// Case- and accent-insensitive, like the backend search: "ibuprofeno" finds "Ibuprofeno".
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const nameMatches = (m: Medication, search: string) => {
  const term = normalize(search.trim());
  return (
    term === '' ||
    normalize(m.commercial_name).includes(term) ||
    m.drugs.some((d) => normalize(d.drug.name).includes(term))
  );
};

// The earliest due date among its (already filtered) existences.
const soonest = (m: Medication) =>
  m.existences.reduce((min, e) => (e.due_date < min ? e.due_date : min), '9999-12-31');

/**
 * The medications to show on the stock page, each with only the existences that match
 * the status filter (e.g. only its expired ones), so they can be thrown away one after another.
 * Medications left with no matching existence are dropped.
 */
export const filterStock = (
  medications: Medication[],
  { status, search, sort }: StockFilters,
  locale: string
): Medication[] => {
  const result = medications
    .filter((m) => nameMatches(m, search))
    .map((m) => ({ ...m, existences: m.existences.filter(statusMatches[status]) }))
    .filter((m) => m.existences.length > 0);

  const byName = (a: Medication, b: Medication) =>
    a.commercial_name.localeCompare(b.commercial_name, locale);
  return result.sort(
    sort === 'expiry' ? (a, b) => soonest(a).localeCompare(soonest(b)) || byName(a, b) : byName
  );
};
