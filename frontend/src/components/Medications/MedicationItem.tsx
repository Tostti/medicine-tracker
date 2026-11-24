import { IconPill } from '@tabler/icons-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Avatar, Badge, Group, Stack, Text } from '@mantine/core';
import { type Medication, pictureSrc, toISODate } from '../../api/medications';

// "Do I have it?": count the existences that haven't expired yet.
const stockStatus = (m: Medication, t: TFunction) => {
  const today = toISODate(new Date());
  const valid = m.existences.filter((e) => e.due_date >= today);
  if (valid.length > 0) {
    return { label: t('medicationItem.inStock', { count: valid.length }), color: 'green' };
  }
  if (m.existences.length > 0) {
    return { label: t('common.expired'), color: 'red' };
  }
  return { label: t('common.noStock'), color: 'gray' };
};

interface MedicationItemProps {
  medication: Medication;
  // The search answers "do I have it?"; the catalog list leaves stock to the Stock tab.
  showStock?: boolean;
}

export const MedicationItem = ({ medication, showStock = false }: MedicationItemProps) => {
  const { t } = useTranslation();
  const status = showStock ? stockStatus(medication, t) : null;
  const details = [medication.type, medication.function].filter(Boolean).join(' · ');
  const drugs = medication.drugs.map((d) => `${d.drug.name} ${d.dose}`).join(', ');

  return (
    <Group wrap="nowrap">
      <Avatar radius="sm" src={pictureSrc(medication.picture_uri)}>
        <IconPill />
      </Avatar>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={500} truncate>
            {medication.commercial_name}
          </Text>
          {status && (
            <Badge color={status.color} variant="light" style={{ flexShrink: 0 }}>
              {status.label}
            </Badge>
          )}
        </Group>
        {drugs && (
          <Text size="sm" truncate>
            {drugs}
          </Text>
        )}
        {details && (
          <Text size="sm" c="dimmed" truncate>
            {details}
          </Text>
        )}
      </Stack>
    </Group>
  );
};
