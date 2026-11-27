import { aMedication, daysFromToday } from '@test-utils';
import { filterStock, isExpired, isExpiringSoon, type StockFilters } from './stockFilters';

let nextId = 1;
const existence = (days: number, low_amount = false) => ({
  id: nextId++,
  due_date: daysFromToday(days),
  low_amount,
});

const defaults: StockFilters = { status: 'all', search: '', sort: 'name' };
const names = (filters: Partial<StockFilters>, medications = stock()) =>
  filterStock(medications, { ...defaults, ...filters }, 'en').map((m) => m.commercial_name);

const stock = () => [
  aMedication({ commercial_name: 'Tafirol', existences: [existence(-3), existence(60)] }),
  aMedication({
    commercial_name: 'Ibuprofeno',
    drugs: [{ dose: '400mg', drug: { id: 1, name: 'Ibuprofeno' } }],
    existences: [existence(10, true)],
  }),
  aMedication({ commercial_name: 'Aspirina', existences: [existence(90)] }),
  aMedication({ commercial_name: 'Empty', existences: [] }),
];

describe('isExpired / isExpiringSoon', () => {
  it('counts today as still in date, and a month ahead as expiring soon', () => {
    expect(isExpired(daysFromToday(-1))).toBe(true);
    expect(isExpired(daysFromToday(0))).toBe(false);
    expect(isExpiringSoon(daysFromToday(0))).toBe(true);
    expect(isExpiringSoon(daysFromToday(20))).toBe(true);
    expect(isExpiringSoon(daysFromToday(45))).toBe(false);
    expect(isExpiringSoon(daysFromToday(-1))).toBe(false);
  });
});

describe('filterStock', () => {
  it('shows only medications with stock, by name', () => {
    expect(names({})).toEqual(['Aspirina', 'Ibuprofeno', 'Tafirol']);
  });

  it('keeps only the existences that match the status', () => {
    const [tafirol] = filterStock(stock(), { ...defaults, status: 'expired' }, 'en');
    expect(tafirol.commercial_name).toBe('Tafirol');
    expect(tafirol.existences.map((e) => e.due_date)).toEqual([daysFromToday(-3)]);
  });

  it('filters by status', () => {
    expect(names({ status: 'expired' })).toEqual(['Tafirol']);
    expect(names({ status: 'expiringSoon' })).toEqual(['Ibuprofeno']);
    expect(names({ status: 'lowAmount' })).toEqual(['Ibuprofeno']);
  });

  it('searches names and drugs, ignoring case and accents', () => {
    expect(names({ search: 'TAFI' })).toEqual(['Tafirol']);
    expect(names({ search: 'áspir' })).toEqual(['Aspirina']);
    expect(names({ search: ' ibupro ' })).toEqual(['Ibuprofeno']);
    expect(names({ search: 'nothing' })).toEqual([]);
  });

  it('sorts by the soonest matching expiration', () => {
    expect(names({ sort: 'expiry' })).toEqual(['Tafirol', 'Ibuprofeno', 'Aspirina']);
  });
});
