import { useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconPencil,
  IconPill,
  IconQuestionMark,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  fetchMedication,
  type Medication,
  NotFoundError,
  pictureSrc,
  setMedicationPicture,
  toISODate,
  updateMedication,
} from '../api/medications';
import {
  MedicationForm,
  type MedicationFormValues,
} from '../components/Medications/MedicationForm';

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const BackLink = () => (
  <Anchor
    component={Link}
    to="/medications"
    size="sm"
    mb="sm"
    display="inline-flex"
    style={{ alignItems: 'center', gap: 4 }}
  >
    <IconArrowLeft size={16} /> Medicamentos
  </Anchor>
);

const Field = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text c={value ? undefined : 'dimmed'}>{value ?? '—'}</Text>
  </div>
);

const MedicationView = ({ medication, onEdit }: { medication: Medication; onEdit: () => void }) => {
  const today = toISODate(new Date());

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="lg">
        <Group wrap="nowrap" align="start">
          <Avatar src={pictureSrc(medication.picture_uri)} size={96} radius="md">
            <IconPill size={40} />
          </Avatar>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Title order={2}>{medication.commercial_name}</Title>
            {medication.common_use && (
              <Badge variant="light" style={{ alignSelf: 'start' }}>
                Uso habitual
              </Badge>
            )}
          </Stack>
          <Tooltip label="Editar">
            <ActionIcon variant="light" size="lg" aria-label="Editar" onClick={onEdit}>
              <IconPencil size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <SimpleGrid cols={{ base: 1, xs: 2 }} mt="md">
          <Field label="Tipo" value={medication.type} />
          <Field label="Función" value={medication.function} />
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="md">
            Composición
          </Title>
          {medication.drugs.length === 0 ? (
            <Text c="dimmed">Sin drogas cargadas</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Droga</Table.Th>
                  <Table.Th>Dosis</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {medication.drugs.map((d) => (
                  <Table.Tr key={d.drug.id}>
                    <Table.Td>{d.drug.name}</Table.Td>
                    <Table.Td>{d.dose}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={3}>Stock</Title>
            <Button
              component={Link}
              to={`/stock?medicamento=${medication.id}`}
              size="xs"
              variant="light"
              rightSection={<IconArrowRight size={14} />}
            >
              Gestionar
            </Button>
          </Group>
          {medication.existences.length === 0 ? (
            <Text c="dimmed">Sin stock</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Vence</Table.Th>
                  <Table.Th>Estado</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {/* The backend already returns them sorted by due date. */}
                {medication.existences.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>{formatDate(e.due_date)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {e.due_date < today ? (
                          <Badge color="red" variant="light">
                            vencido
                          </Badge>
                        ) : (
                          <Badge color="green" variant="light">
                            vigente
                          </Badge>
                        )}
                        {e.low_amount && (
                          <Badge color="orange" variant="light">
                            queda poco
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
};

export function MedicationDetailPage() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, error, isPending } = useQuery({
    queryKey: ['medications', 'detail', id],
    queryFn: () => fetchMedication(id),
    enabled: validId,
    // A missing medication won't appear by retrying.
    retry: (count, err) => !(err instanceof NotFoundError) && count < 3,
  });

  const handleSubmit = async (values: MedicationFormValues) => {
    let updated = await updateMedication(id, {
      commercial_name: values.commercial_name,
      type: values.type || null,
      function: values.function || null,
      common_use: values.common_use,
      drugs: values.drugs,
    });
    if (values.picture) {
      // Its own endpoint: it also deletes the previous uploaded picture.
      updated = await setMedicationPicture(id, values.picture);
    }

    // Show the saved version right away, then refresh everything else that lists medications.
    queryClient.setQueryData(['medications', 'detail', id], updated);
    await queryClient.invalidateQueries({ queryKey: ['medications'] });
    await queryClient.invalidateQueries({ queryKey: ['drugs'] });
    setEditing(false);
  };

  let content;
  if (!validId || error instanceof NotFoundError) {
    content = (
      <EmptyState
        icon={<IconQuestionMark />}
        title="Medicamento no encontrado"
        description="Puede que la dirección esté mal escrita."
      />
    );
  } else if (error) {
    content = <Text c="red">{error.message}</Text>;
  } else if (isPending) {
    content = (
      <Stack gap="md">
        <Skeleton height={180} radius="md" />
        <Skeleton height={160} radius="md" />
      </Stack>
    );
  } else if (editing) {
    content = (
      <Card withBorder radius="md" padding="lg" maw={720}>
        <Title order={2} mb="md">
          Editar medicamento
        </Title>
        <MedicationForm
          medication={data}
          submitLabel="Guardar"
          onSubmit={handleSubmit}
          onCancel={() => setEditing(false)}
        />
      </Card>
    );
  } else {
    content = <MedicationView medication={data} onEdit={() => setEditing(true)} />;
  }

  return (
    <>
      <BackLink />
      {content}
    </>
  );
}
