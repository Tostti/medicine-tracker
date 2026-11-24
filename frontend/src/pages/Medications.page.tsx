import { useEffect } from 'react';
import { IconPill, IconPlus } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Button,
  EmptyState,
  Group,
  Loader,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useInViewport } from '@mantine/hooks';
import { fetchMedications } from '../api/medications';
import { MedicationItem } from '../components/Medications/MedicationItem';

const PAGE_SIZE = 20;

export function MedicationsPage() {
  const { t } = useTranslation();
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['medications', 'list'],
      queryFn: ({ pageParam }) => fetchMedications({ skip: pageParam, limit: PAGE_SIZE }),
      initialPageParam: 0,
      // The backend gives no total: a short page means there's nothing after it.
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
      select: (d) => d.pages.flat(),
    });

  // An empty element after the last item: when it scrolls into view, load the next page.
  const { ref: sentinelRef, inViewport } = useInViewport();
  useEffect(() => {
    if (inViewport && hasNextPage && !isFetchingNextPage) {
      // Errors land in the query state; nothing to handle here.
      void fetchNextPage();
    }
  }, [inViewport, hasNextPage, isFetchingNextPage, fetchNextPage]);

  let content;
  if (isPending) {
    content = (
      <Stack gap="sm">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={64} radius="md" />
        ))}
      </Stack>
    );
  } else if (error) {
    content = <Text c="red">{error.message}</Text>;
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
      {content}
    </>
  );
}
