import { useEffect } from 'react';
import { IconFilterOff, IconPill, IconPlus, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  Chip,
  EmptyState,
  EmptyStateActions,
  Group,
  Loader,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useInViewport } from '@mantine/hooks';
import { fetchMedications, type MedicationSort } from '../api/medications';
import { MedicationItem } from '../components/Medications/MedicationItem';

const PAGE_SIZE = 20;

// The list is paginated by the backend, so filtering and sorting happen there: filtering
// only the pages loaded so far would miss matches further down.
interface ListFilters {
  search: string;
  inStock: boolean;
  essential: boolean;
  sort: MedicationSort;
}

// Spanish URL values, like the stock page (?orden=recientes). By name is the default.
const SORT_PARAM: Record<string, MedicationSort> = { recientes: 'newest', antiguos: 'id' };

// Filters live in the URL, so a reload or the back button (e.g. from a medication's detail)
// keeps them. Defaults are left out: plain /medications means "everything, by name".
const useListFilters = () => {
  const [params, setParams] = useSearchParams();
  const filters: ListFilters = {
    search: params.get('buscar') ?? '',
    inStock: params.has('en-stock'),
    essential: params.has('esencial'),
    sort: SORT_PARAM[params.get('orden') ?? ''] ?? 'name',
  };

  const update = (changes: Partial<ListFilters>) => {
    const next = { ...filters, ...changes };
    const nextParams = new URLSearchParams();
    if (next.search) {
      nextParams.set('buscar', next.search);
    }
    if (next.inStock) {
      nextParams.set('en-stock', '');
    }
    if (next.essential) {
      nextParams.set('esencial', '');
    }
    const orden = Object.keys(SORT_PARAM).find((key) => SORT_PARAM[key] === next.sort);
    if (orden) {
      nextParams.set('orden', orden);
    }
    // replace: typing in the search box shouldn't add a history entry per keystroke.
    setParams(nextParams, { replace: true });
  };

  return [filters, update] as const;
};

export function MedicationsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useListFilters();
  // The box updates at once; the request waits until typing pauses.
  const [search] = useDebouncedValue(filters.search.trim(), 300);

  const query = {
    q: search || undefined,
    in_stock: filters.inStock || undefined,
    essential: filters.essential || undefined,
    sort: filters.sort,
  };
  const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery({
      // Each combination is cached on its own (and saved for offline use).
      queryKey: ['medications', 'list', query],
      queryFn: ({ pageParam }) => fetchMedications({ ...query, skip: pageParam, limit: PAGE_SIZE }),
      initialPageParam: 0,
      // The backend gives no total: a short page means there's nothing after it.
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
      select: (d) => d.pages.flat(),
      // Keep showing the previous results while a new filter loads, instead of skeletons.
      placeholderData: keepPreviousData,
    });

  // An empty element after the last item: when it scrolls into view, load the next page.
  const { ref: sentinelRef, inViewport } = useInViewport();
  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      // Errors land in the query state; nothing to handle here.
      void fetchNextPage();
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = filters.search !== '' || filters.inStock || filters.essential;

  let content;
  if (data === undefined) {
    // Only without saved data: a failed refetch keeps showing the cached list.
    content = error ? (
      <Text c="red">{error.message}</Text>
    ) : (
      <Stack gap="sm">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={64} radius="md" />
        ))}
      </Stack>
    );
  } else if (data.length === 0 && filtered) {
    content = (
      <EmptyState
        icon={<IconFilterOff />}
        title={t('medications.noFilterMatchTitle')}
        description={t('medications.noFilterMatchText')}
      >
        <EmptyStateActions>
          <Button
            variant="default"
            onClick={() => setFilters({ search: '', inStock: false, essential: false })}
          >
            {t('medications.clearFilters')}
          </Button>
        </EmptyStateActions>
      </EmptyState>
    );
  } else if (data.length === 0) {
    content = (
      <EmptyState
        icon={<IconPill />}
        title={t('medications.emptyTitle')}
        description={t('medications.emptyText')}
      />
    );
  } else {
    content = (
      <Stack gap="sm">
        {data.map((m) => (
          <Paper
            key={m.id}
            component={Link}
            to={`/medications/${m.id}`}
            withBorder
            radius="md"
            p="sm"
          >
            <MedicationItem medication={m} />
          </Paper>
        ))}
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <Group justify="center">
            <Loader size="sm" />
          </Group>
        )}
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('medications.title')}</Title>
        <Button component={Link} to="/medications/new" leftSection={<IconPlus size={18} />}>
          {t('common.add')}
        </Button>
      </Group>
      <Stack gap="sm" mb="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            aria-label={t('medications.searchLabel')}
            placeholder={t('search.placeholder')}
            leftSection={<IconSearch size={16} />}
            // Spins while a new filter loads, since the old results stay on screen meanwhile.
            rightSection={isFetching && !isFetchingNextPage ? <Loader size="xs" /> : null}
            value={filters.search}
            onChange={(e) => setFilters({ search: e.currentTarget.value })}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Select
            aria-label={t('medications.sortLabel')}
            data={[
              { value: 'name', label: t('medications.sortName') },
              { value: 'newest', label: t('medications.sortNewest') },
              { value: 'id', label: t('medications.sortOldest') },
            ]}
            value={filters.sort}
            onChange={(sort) => sort && setFilters({ sort: sort as MedicationSort })}
            allowDeselect={false}
            w={{ base: '100%', xs: 200 }}
          />
        </Group>
        {/* Independent toggles: both on means "in stock AND essential". */}
        <Group gap="xs">
          <Chip checked={filters.inStock} onChange={(inStock) => setFilters({ inStock })}>
            {t('medications.inStock')}
          </Chip>
          <Chip checked={filters.essential} onChange={(essential) => setFilters({ essential })}>
            {t('essentials.essential')}
          </Chip>
        </Group>
      </Stack>
      {content}
    </>
  );
}
