import type { ReactNode } from 'react';
import { IconCalendarCheck, IconTrashOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { fetchMedications, type Medication, toISODate } from '../../api/medications';

const UPCOMING_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Expiration {
  id: number;
  medication: string;
  dueDate: string;
  daysLeft: number; // negative once expired
}

// "YYYY-MM-DD" parsed as a local date (new Date("YYYY-MM-DD") would be UTC midnight).
const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = (iso: string) =>
  parseISODate(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const pluralDays = (n: number) => (n === 1 ? '1 día' : `${n} días`);

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
  badge: (e: Expiration) => { label: string; color: string };
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
            <Table.Th>Medicamento</Table.Th>
            <Table.Th>{dateHeader}</Table.Th>
            <Table.Th>{badgeHeader}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((e) => {
            const { label, color } = badge(e);
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

const upcomingBadge = ({ daysLeft }: Expiration) => ({
  label: daysLeft === 0 ? 'hoy' : pluralDays(daysLeft),
  color: daysLeft <= 7 ? 'red' : daysLeft <= 30 ? 'orange' : 'gray',
});

export const NextExpirations = () => (
  <ExpirationsCard
    title="Próximos vencimientos"
    dateHeader="Vence"
    badgeHeader="Faltan"
    query={useExpirations(selectUpcoming)}
    badge={upcomingBadge}
    empty={
      <EmptyState
        icon={<IconCalendarCheck />}
        title="Nada por vencer"
        description="No hay existencias con vencimiento futuro"
      />
    }
  />
);

// All of them, oldest first: it's the list of what to throw away.
const selectExpired = (all: Expiration[]) => all.filter((e) => e.daysLeft < 0);

const expiredBadge = ({ daysLeft }: Expiration) => ({
  label: `hace ${pluralDays(-daysLeft)}`,
  color: 'red',
});

export const ExpiredList = () => (
  <ExpirationsCard
    title="Vencidos"
    dateHeader="Venció"
    badgeHeader="Hace"
    query={useExpirations(selectExpired)}
    badge={expiredBadge}
    empty={
      <EmptyState
        icon={<IconTrashOff />}
        title="Nada vencido"
        description="No hay nada para descartar"
      />
    }
  />
);
