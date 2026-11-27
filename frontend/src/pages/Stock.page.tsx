import { IconArrowLeft, IconPackageOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Anchor,
  EmptyState,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { fetchMedication, fetchMedications, NotFoundError } from '../api/medications';
import { MedicationStockCard } from '../components/Stock/MedicationStockCard';
import { locale } from '../i18n';

const loading = (
  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
    <Skeleton height={140} radius="md" />
    <Skeleton height={140} radius="md" />
  </SimpleGrid>
);

// Opened from a medication's detail page: only that medication, even with no stock yet.
const SingleMedicationStock = ({ id }: { id: number }) => {
  const { t } = useTranslation();
  const { data, error } = useQuery({
    queryKey: ['medications', 'detail', id],
    queryFn: () => fetchMedication(id),
    retry: (count, err) =>
      !(err instanceof NotFoundError) && !(err instanceof TypeError) && count < 3,
  });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('stock.title')}</Title>
        <Anchor
          component={Link}
          to="/stock"
          size="sm"
          display="inline-flex"
          style={{ alignItems: 'center', gap: 4 }}
        >
          <IconArrowLeft size={16} /> {t('stock.seeAll')}
        </Anchor>
      </Group>
      {/* A failed refetch keeps showing the cached data; the error only when there's none. */}
      {data === undefined ? (
        error ? (
          <Text c="red">{error.message}</Text>
        ) : (
          loading
        )
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <MedicationStockCard medication={data} />
        </SimpleGrid>
      )}
    </>
  );
};

const AllStock = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // All of them, not only the ones with stock: the selector also lets you add stock to the rest.
  const filters = { limit: 1000 };
  const { data, error } = useQuery({
    queryKey: ['medications', filters],
    queryFn: () => fetchMedications(filters),
    select: (medications) =>
      [...medications].sort((a, b) => a.commercial_name.localeCompare(b.commercial_name, locale())),
  });

  const withStock = data?.filter((m) => m.existences.length > 0) ?? [];

  return (
    <>
      <Group justify="space-between" align="end" mb="md" wrap="wrap">
        <Title order={2}>{t('stock.title')}</Title>
        <Select
          aria-label={t('stock.addToLabel')}
          placeholder={t('stock.addTo')}
          searchable
          nothingFoundMessage={t('stock.noMatch')}
          data={(data ?? []).map((m) => ({ value: String(m.id), label: m.commercial_name }))}
          value={null}
          onChange={(id) => id && navigate(`/stock?medicamento=${id}`)}
          w={{ base: '100%', xs: 260 }}
        />
      </Group>
      {data === undefined ? (
        error ? (
          <Text c="red">{error.message}</Text>
        ) : (
          loading
        )
      ) : withStock.length === 0 ? (
        <EmptyState
          icon={<IconPackageOff />}
          title={t('stock.emptyTitle')}
          description={t('stock.emptyText')}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {withStock.map((m) => (
            <MedicationStockCard key={m.id} medication={m} />
          ))}
        </SimpleGrid>
      )}
    </>
  );
};

export function StockPage() {
  const [params] = useSearchParams();
  const id = Number(params.get('medicamento'));

  return (
    <Stack gap={0}>
      {Number.isInteger(id) && id > 0 ? <SingleMedicationStock id={id} /> : <AllStock />}
    </Stack>
  );
}
