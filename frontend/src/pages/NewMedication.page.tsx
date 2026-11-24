import { Card, Title } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createMedication, uploadImage } from '../api/medications';
import { MedicationForm, type MedicationFormValues } from '../components/Medications/MedicationForm';

export function NewMedicationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Coming from a search with no results: ?nombre=... prefills the name.
  const [params] = useSearchParams();

  const handleSubmit = async (values: MedicationFormValues) => {
    // The picture goes up first: the medication is created with the key it gets back.
    const picture_uri = values.picture ? await uploadImage(values.picture) : null;
    const created = await createMedication({
      commercial_name: values.commercial_name,
      type: values.type || null,
      function: values.function || null,
      common_use: values.common_use,
      picture_uri,
      drugs: values.drugs,
      existences: values.existences,
    });

    // Lists, home cards and search all start with 'medications'; new drugs may exist too.
    await queryClient.invalidateQueries({ queryKey: ['medications'] });
    await queryClient.invalidateQueries({ queryKey: ['drugs'] });
    // replace: going back from the new medication shouldn't reopen an empty form.
    void navigate(`/medications/${created.id}`, { replace: true });
  };

  return (
    <Card withBorder radius="md" padding="lg" maw={720}>
      <Title order={2} mb="md">
        Nuevo medicamento
      </Title>
      <MedicationForm
        initialName={params.get('nombre') ?? ''}
        submitLabel="Crear"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/medications')}
      />
    </Card>
  );
}
