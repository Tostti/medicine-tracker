import { aMedication, fireEvent, jsonResponse, mockFetch, renderApp, screen } from '@test-utils';
import type { Medication } from '../../api/medications';
import { MedicationForm, type MedicationFormValues } from './MedicationForm';

function setup({
  medication,
  initialName,
}: { medication?: Medication; initialName?: string } = {}) {
  mockFetch(() => jsonResponse([{ id: 1, name: 'Ibuprofeno' }]));
  const onSubmit = vi.fn<(values: MedicationFormValues) => Promise<void>>(() => Promise.resolve());
  const onCancel = vi.fn();
  renderApp(
    <MedicationForm
      medication={medication}
      initialName={initialName}
      submitLabel="Create"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
  return { onSubmit, onCancel };
}

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Create' }));
const drugInputs = () => screen.getAllByRole('combobox', { name: 'Drug' });
const doseInputs = () => screen.getAllByRole('textbox', { name: 'Dose' });

describe('MedicationForm', () => {
  it('submits the trimmed values', async () => {
    const { onSubmit } = setup();

    type(screen.getByLabelText(/Brand name/), '  Tafirol  ');
    type(screen.getByLabelText('Type'), ' Tablets ');
    type(screen.getByLabelText('Function'), '');
    type(drugInputs()[0], ' Paracetamol ');
    type(doseInputs()[0], ' 500 mg ');
    submit();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      commercial_name: 'Tafirol',
      type: 'Tablets',
      function: '',
      picture: null,
      drugs: [{ name: 'Paracetamol', dose: '500 mg' }],
      existences: [],
    });
  });

  it('starts with the searched name', () => {
    setup({ initialName: 'Tafirol' });

    expect(screen.getByLabelText(/Brand name/)).toHaveValue('Tafirol');
  });

  it('requires a name', async () => {
    const { onSubmit } = setup();

    submit();

    expect(await screen.findByText('Enter the name')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores an empty drug row', async () => {
    const { onSubmit } = setup();

    type(screen.getByLabelText(/Brand name/), 'Tafirol');
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));
    type(drugInputs()[1], 'Paracetamol');
    type(doseInputs()[1], '1 g');
    submit();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].drugs).toEqual([{ name: 'Paracetamol', dose: '1 g' }]);
  });

  it('asks for the missing half of a drug row', async () => {
    const { onSubmit } = setup();
    type(screen.getByLabelText(/Brand name/), 'Tafirol');
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));

    type(drugInputs()[0], 'Paracetamol');
    type(doseInputs()[1], '1 g');
    submit();

    expect(await screen.findByText('Dose required')).toBeInTheDocument();
    expect(screen.getByText('Drug required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects the same drug twice, ignoring case', async () => {
    const { onSubmit } = setup();
    type(screen.getByLabelText(/Brand name/), 'Tafirol');
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));

    type(drugInputs()[0], 'Paracetamol');
    type(doseInputs()[0], '500 mg');
    type(drugInputs()[1], 'paracetamol ');
    type(doseInputs()[1], '1 g');
    submit();

    expect(await screen.findAllByText('Repeated')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes a drug row', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));
    type(drugInputs()[1], 'Paracetamol');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove drug' })[0]);

    expect(drugInputs().map((input) => (input as HTMLInputElement).value)).toEqual(['Paracetamol']);
  });

  it('sends the initial stock, and needs a date for each row', async () => {
    const { onSubmit } = setup();
    type(screen.getByLabelText(/Brand name/), 'Tafirol');
    fireEvent.click(screen.getByRole('button', { name: 'Add expiration date' }));

    submit();
    expect(await screen.findByText('Date required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    type(screen.getByLabelText('Expiration date'), '2027-03-31');
    fireEvent.click(screen.getByLabelText('Running low'));
    submit();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].existences).toEqual([
      { due_date: '2027-03-31', low_amount: true },
    ]);
  });

  it('shows why saving failed', async () => {
    const { onSubmit } = setup({ initialName: 'Tafirol' });
    onSubmit.mockRejectedValue(new Error('Drug 9 not found'));

    submit();

    expect(await screen.findByText('Drug 9 not found')).toBeInTheDocument();
    expect(screen.getByText('Couldn’t save')).toBeInTheDocument();
  });

  it('cancels', () => {
    const { onCancel } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  describe('editing', () => {
    const medication = aMedication({
      commercial_name: 'Tafirol',
      type: 'Tablets',
      function: null,
      picture_uri: 'https://example.com/a.jpg',
      drugs: [{ dose: '500 mg', drug: { id: 1, name: 'Paracetamol' } }],
    });

    it('starts from the medication', () => {
      setup({ medication });

      expect(screen.getByLabelText(/Brand name/)).toHaveValue('Tafirol');
      expect(screen.getByLabelText('Type')).toHaveValue('Tablets');
      expect(screen.getByLabelText('Function')).toHaveValue('');
      expect(drugInputs()[0]).toHaveValue('Paracetamol');
      expect(doseInputs()[0]).toHaveValue('500 mg');
      expect(screen.getByText('Change picture')).toBeInTheDocument();
    });

    it('has no initial stock: that is managed in the Stock tab', () => {
      setup({ medication });

      expect(screen.queryByText('Initial stock')).not.toBeInTheDocument();
    });
  });
});
