import type { ReactNode } from 'react';
import { IconCalendarCheck, IconTrashOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { fetchMedications, type Medication, toISODate } from '../../api/medications';
import { formatDate, parseISODate } from '../../i18n';

const UPCOMING_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Expiration {
  id: number;
  medication: string;
  dueDate: string;
  daysLeft: number; // negative once expired
}

// Every existence of every medication, soonest first.
const toExpirations = (medications: Medication[]): Expiration[] => {
  const today = parseISODate(toISODate(new Date())).getTime();

  return medications
    .flatMap((m) =>
      m.existences.map((e) => ({
        id: e.id,
        medication: m.commercial_name,
        dueDate: e.due_date,
        daysLeft: Math.round((parseISODate(e.due_date).getTime() - today) / DAY_MS),
      }))
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
};

const filters = {};

const useExpirations = (select: (all: Expiration[]) => Expiration[]) =>
  useQuery({
    queryKey: ['medications', filters],
    queryFn: () => fetchMedications(filters),
    select: (medications) => select(toExpirations(medications)),
  });

interface ExpirationsCardProps {
  title: string;
  dateHeader: string;
  badgeHeader: string;
  query: ReturnType<typeof useExpirations>;
  badge: (e: Expiration, t: TFunction) => { label: string; color: string };
  empty: ReactNode;
}

const ExpirationsCard = ({
  title,
  dateHeader,
  badgeHeader,
  query,
  badge,
  empty,
}: ExpirationsCardProps) => {
  const { t } = useTranslation();
  const { isPending, error, data } = query;

  let content: ReactNode;
  if (isPending) {
    content = (
      <Stack gap="xs">
        <Skeleton height={8} radius="xl" />
        <Skeleton height={8} radius="xl" />
        <Skeleton height={8} radius="xl" />
        <Skeleton height={8} radius="xl" />
      </Stack>
    );
  } else if (error) {
    content = <Text c="red">{error.message}</Text>;
  } else if (data.length === 0) {
    content = empty;
  } else {
    content = (
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('common.medication')}</Table.Th>
            <Table.Th>{dateHeader}</Table.Th>
            <Table.Th>{badgeHeader}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((e) => {
            const { label, color } = badge(e, t);
            return (
              <Table.Tr key={e.id}>
                <Table.Td>{e.medication}</Table.Td>
                <Table.Td>{formatDate(e.dueDate)}</Table.Td>
                <Table.Td>
                  <Badge color={color} variant="light">
                    {label}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    );
  }

  return (
    <>
      <Title order={3} mb="md">
        {title}
      </Title>
      {content}
    </>
  );
};

const selectUpcoming = (all: Expiration[]) =>
  all.filter((e) => e.daysLeft >= 0).slice(0, UPCOMING_LIMIT);

const upcomingBadge = ({ daysLeft }: Expiration, t: TFunction) => ({
  label: daysLeft === 0 ? t('expirations.today') : t('expirations.days', { count: daysLeft }),
  color: daysLeft <= 7 ? 'red' : daysLeft <= 30 ? 'orange' : 'gray',
});

export const NextExpirations = () => {
  const { t } = useTranslation();
  return (
    <ExpirationsCard
      title={t('expirations.upcomingTitle')}
      dateHeader={t('expirations.upcomingDate')}
      badgeHeader={t('expirations.upcomingLeft')}
      query={useExpirations(selectUpcoming)}
      badge={upcomingBadge}
      empty={
        <EmptyState
          icon={<IconCalendarCheck />}
          title={t('expirations.upcomingEmptyTitle')}
          description={t('expirations.upcomingEmptyText')}
        />
      }
    />
  );
};

// All of them, oldest first: it's the list of what to throw away.
const selectExpired = (all: Expiration[]) => all.filter((e) => e.daysLeft < 0);

const expiredBadge = ({ daysLeft }: Expiration, t: TFunction) => ({
  label: t('expirations.daysAgo', { count: -daysLeft }),
  color: 'red',
});

export const ExpiredList = () => {
  const { t } = useTranslation();
  return (
    <ExpirationsCard
      title={t('expirations.expiredTitle')}
      dateHeader={t('expirations.expiredDate')}
      badgeHeader={t('expirations.expiredAgo')}
      query={useExpirations(selectExpired)}
      badge={expiredBadge}
      empty={
        <EmptyState
          icon={<IconTrashOff />}
          title={t('expirations.expiredEmptyTitle')}
          description={t('expirations.expiredEmptyText')}
        />
      }
    />
  );
};
