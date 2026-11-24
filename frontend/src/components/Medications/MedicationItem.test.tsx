import { aMedication, daysFromToday, render, screen } from '@test-utils';
import { MedicationItem } from './MedicationItem';

const existence = (id: number, days: number) => ({
  id,
  due_date: daysFromToday(days),
  low_amount: false,
});

describe('MedicationItem', () => {
  it('shows the name, the drugs and the details', () => {
    render(
      <MedicationItem
        medication={aMedication({
          commercial_name: 'Tafirol Plus',
          type: 'Tablets',
          function: 'Painkiller',
          drugs: [
            { dose: '500 mg', drug: { id: 1, name: 'Paracetamol' } },
            { dose: '65 mg', drug: { id: 2, name: 'Cafeína' } },
          ],
        })}
      />
    );

    expect(screen.getByText('Tafirol Plus')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500 mg, Cafeína 65 mg')).toBeInTheDocument();
    expect(screen.getByText('Tablets · Painkiller')).toBeInTheDocument();
  });

  it('hides the stock unless asked', () => {
    render(<MedicationItem medication={aMedication({ existences: [existence(1, 10)] })} />);

    expect(screen.queryByText(/In stock/)).not.toBeInTheDocument();
  });

  it.each([
    [
      'counts the units that haven’t expired',
      [existence(1, 10), existence(2, 0), existence(3, -1)],
      'In stock (2)',
    ],
    ['says when everything expired', [existence(1, -1)], 'Expired'],
    ['says when there is nothing', [], 'Out of stock'],
  ])('%s', (_, existences, label) => {
    render(<MedicationItem medication={aMedication({ existences })} showStock />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
