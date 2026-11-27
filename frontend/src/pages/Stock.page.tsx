import { IconArrowLeft, IconFilterOff, IconPackageOff, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Anchor,
  Button,
  Chip,
  EmptyState,
  EmptyStateActions,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { fetchMedication, fetchMedications, NotFoundError } from '../api/medications';
import { MedicationStockCard } from '../components/Stock/MedicationStockCard';
import {
  filterStock,
  type StockFilters,
  type StockSort,
  type StockStatus,
} from '../components/Stock/stockFilters';
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

// Filters live in the URL (/stock?estado=vencidos), so the home page can link to a filtered view
// and a reload or the back button keeps them. Spanish names, like ?medicamento= above.
const STATUS_PARAM: Record<string, StockStatus> = {
  vencidos: 'expired',
  'por-vencer': 'expiringSoon',
  'queda-poco': 'lowAmount',
};
const statusToParam = (status: StockStatus) =>
  Object.keys(STATUS_PARAM).find((key) => STATUS_PARAM[key] === status);

const useStockFilters = () => {
  const [params, setParams] = useSearchParams();
  const filters: StockFilters = {
    status: STATUS_PARAM[params.get('estado') ?? ''] ?? 'all',
    search: params.get('buscar') ?? '',
    sort: params.get('orden') === 'vencimiento' ? 'expiry' : 'name',
  };

  // Defaults are left out of the URL, so plain /stock means "everything, by name".
  const update = (changes: Partial<StockFilters>) => {
    const next = { ...filters, ...changes };
    const nextParams = new URLSearchParams();
    const estado = statusToParam(next.status);
    if (estado) {
      nextParams.set('estado', estado);
    }
    if (next.search) {
      nextParams.set('buscar', next.search);
    }
    if (next.sort === 'expiry') {
      nextParams.set('orden', 'vencimiento');
    }
    // replace: typing in the search box shouldn't add a history entry per keystroke.
    setParams(nextParams, { replace: true });
  };

  return [filters, update] as const;
};

const AllStock = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useStockFilters();
  // All of them, not only the ones with stock: the selector also lets you add stock to the rest.
  const params = { limit: 1000 };
  const { data, error } = useQuery({
    queryKey: ['medications', params],
    queryFn: () => fetchMedications(params),
    select: (medications) =>
      [...medications].sort((a, b) => a.commercial_name.localeCompare(b.commercial_name, locale())),
  });

  // Everything is already loaded, so filtering happens here (and works offline too).
  const shown = data ? filterStock(data, filters, locale()) : [];
  const hasStock = data?.some((m) => m.existences.length > 0) ?? false;

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
      {hasStock && (
        <Stack gap="sm" mb="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              aria-label={t('stock.searchLabel')}
              placeholder={t('stock.searchPlaceholder')}
              leftSection={<IconSearch size={16} />}
              value={filters.search}
              onChange={(e) => setFilters({ search: e.currentTarget.value })}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              aria-label={t('stock.sortLabel')}
              data={[
                { value: 'name', label: t('stock.sortName') },
                { value: 'expiry', label: t('stock.sortExpiry') },
              ]}
              value={filters.sort}
              onChange={(sort) => sort && setFilters({ sort: sort as StockSort })}
              allowDeselect={false}
              w={{ base: '100%', xs: 200 }}
            />
          </Group>
          {/* Chips wrap on narrow phones, where a segmented control would overflow. */}
          <Chip.Group
            value={filters.status}
            onChange={(status) => setFilters({ status: status as StockStatus })}
          >
            <Group gap="xs" role="radiogroup" aria-label={t('stock.statusLabel')}>
              <Chip value="all">{t('stock.statusAll')}</Chip>
              <Chip value="expired" color="red">
                {t('common.expired')}
              </Chip>
              <Chip value="expiringSoon" color="orange">
                {t('common.expiringSoon')}
              </Chip>
              <Chip value="lowAmount">{t('common.lowAmount')}</Chip>
            </Group>
          </Chip.Group>
        </Stack>
      )}
      {data === undefined ? (
        error ? (
          <Text c="red">{error.message}</Text>
        ) : (
          loading
        )
      ) : !hasStock ? (
        <EmptyState
          icon={<IconPackageOff />}
          title={t('stock.emptyTitle')}
          description={t('stock.emptyText')}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<IconFilterOff />}
          title={t('stock.noFilterMatchTitle')}
          description={t('stock.noFilterMatchText')}
        >
          <EmptyStateActions>
            <Button variant="default" onClick={() => setFilters({ status: 'all', search: '' })}>
              {t('stock.clearFilters')}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {shown.map((m) => (
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
