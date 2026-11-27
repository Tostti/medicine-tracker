import { useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconPencil,
  IconPill,
  IconQuestionMark,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { EssentialControl } from '../components/Essentials/EssentialControl';
import {
  MedicationForm,
  type MedicationFormValues,
} from '../components/Medications/MedicationForm';
import { formatDate } from '../i18n';

const BackLink = () => {
  const { t } = useTranslation();
  return (
    <Anchor
      component={Link}
      to="/medications"
      size="sm"
      mb="sm"
      display="inline-flex"
      style={{ alignItems: 'center', gap: 4 }}
    >
      <IconArrowLeft size={16} /> {t('detail.back')}
    </Anchor>
  );
};

const Field = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
      {label}
    </Text>
    <Text c={value ? undefined : 'dimmed'}>{value ?? '—'}</Text>
  </div>
);

const MedicationView = ({ medication, onEdit }: { medication: Medication; onEdit: () => void }) => {
  const { t } = useTranslation();
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
            <EssentialControl medication={medication} />
          </Stack>
          <Tooltip label={t('common.edit')}>
            <ActionIcon variant="light" size="lg" aria-label={t('common.edit')} onClick={onEdit}>
              <IconPencil size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <SimpleGrid cols={{ base: 1, xs: 2 }} mt="md">
          <Field label={t('detail.type')} value={medication.type} />
          <Field label={t('detail.function')} value={medication.function} />
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="md">
            {t('detail.composition')}
          </Title>
          {medication.drugs.length === 0 ? (
            <Text c="dimmed">{t('detail.noDrugs')}</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.drug')}</Table.Th>
                  <Table.Th>{t('detail.dose')}</Table.Th>
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
            <Title order={3}>{t('detail.stock')}</Title>
            <Button
              component={Link}
              to={`/stock?medicamento=${medication.id}`}
              size="xs"
              variant="light"
              rightSection={<IconArrowRight size={14} />}
            >
              {t('detail.manage')}
            </Button>
          </Group>
          {medication.existences.length === 0 ? (
            <Text c="dimmed">{t('common.noStock')}</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.expires')}</Table.Th>
                  <Table.Th>{t('detail.status')}</Table.Th>
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
                            {t('common.expired')}
                          </Badge>
                        ) : (
                          <Badge color="green" variant="light">
                            {t('common.valid')}
                          </Badge>
                        )}
                        {e.low_amount && (
                          <Badge color="orange" variant="light">
                            {t('common.lowAmount')}
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
  const { t } = useTranslation();
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, error } = useQuery({
    queryKey: ['medications', 'detail', id],
    queryFn: () => fetchMedication(id),
    enabled: validId,
    // A missing medication won't appear by retrying.
    retry: (count, err) =>
      !(err instanceof NotFoundError) && !(err instanceof TypeError) && count < 3,
  });

  const handleSubmit = async (values: MedicationFormValues) => {
    let updated = await updateMedication(id, {
      commercial_name: values.commercial_name,
      type: values.type || null,
      function: values.function || null,
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
        title={t('detail.notFoundTitle')}
        description={t('detail.notFoundText')}
      />
    );
  } else if (data === undefined) {
    // Only without saved data: a failed refetch keeps showing the cached medication.
    content = error ? (
      <Text c="red">{error.message}</Text>
    ) : (
      <Stack gap="md">
        <Skeleton height={180} radius="md" />
        <Skeleton height={160} radius="md" />
      </Stack>
    );
  } else if (editing) {
    content = (
      <Card withBorder radius="md" padding="lg" maw={720}>
        <Title order={2} mb="md">
          {t('medications.editTitle')}
        </Title>
        <MedicationForm
          medication={data}
          submitLabel={t('common.save')}
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
