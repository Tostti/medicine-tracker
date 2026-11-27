import { IconCheck, IconListCheck, IconSettings } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Button,
  EmptyState,
  EmptyStateActions,
  Group,
  List,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  compositionLabel,
  type EssentialDetail,
  essentialsQueryKey,
  fetchEssentials,
} from '../../api/essentials';
import { type Existence, toISODate } from '../../api/medications';

type BuyingReason = 'noStock' | 'expired' | 'lowAmount' | 'expiringSoon';

interface BuyingItem {
  essential: EssentialDetail;
  reasons: BuyingReason[];
}

const reasonColor: Record<BuyingReason, string> = {
  noStock: 'red',
  expired: 'red',
  lowAmount: 'orange',
  expiringSoon: 'yellow',
};

const oneMonthFromToday = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
};

// The stock of every brand that covers the essential counts together: two boxes of
// Ibupirac about to expire are fine if there's a box of Actron for next year.
const getBuyingReasons = (stock: Existence[], today: string, limit: string): BuyingReason[] => {
  if (stock.length === 0) {
    return ['noStock'];
  }

  // Expired existences don't count as stock: only the valid ones are checked below.
  const valid = stock.filter((e) => e.due_date >= today);
  if (valid.length === 0) {
    return ['expired'];
  }

  const reasons: BuyingReason[] = [];
  if (valid.every((e) => e.due_date <= limit)) {
    reasons.push('expiringSoon');
  }
  if (valid.length === 1 && valid[0].low_amount) {
    reasons.push('lowAmount');
  }
  return reasons;
};

const toBuyingList = (essentials: EssentialDetail[]): BuyingItem[] => {
  const today = toISODate(new Date());
  const limit = oneMonthFromToday();
  return essentials.flatMap((essential) => {
    const stock = essential.medications.flatMap((m) => m.existences);
    const reasons = getBuyingReasons(stock, today, limit);
    return reasons.length > 0 ? [{ essential, reasons }] : [];
  });
};

const MAX_BRANDS = 2;

/**
 * What to call an item of the list. A brand is easier to recognize than its composition
 * ("Buscapina compositum" vs "Hioscina butilbromuro 10mg + Dipirona 250mg"), so the
 * brands go on top when there are any, and the composition below. With no brand at home,
 * the composition is all there is.
 */
const itemLabels = (essential: EssentialDetail, t: TFunction) => {
  const composition = compositionLabel(essential.drugs);
  const brands = essential.medications.map((m) => m.commercial_name);
  if (brands.length === 0) {
    return { title: composition, subtitle: null };
  }
  const shown = brands.slice(0, MAX_BRANDS).join(', ');
  const hidden = brands.length - MAX_BRANDS;
  return {
    title: hidden > 0 ? t('buyingList.moreBrands', { names: shown, count: hidden }) : shown,
    subtitle: composition,
  };
};

const BuyingList = () => {
  const { t } = useTranslation();
  const { error, data } = useQuery({
    queryKey: essentialsQueryKey,
    queryFn: fetchEssentials,
  });
  const items = data && toBuyingList(data);

  return (
    <>
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Title order={3}>{t('buyingList.title')}</Title>
        <Anchor component={Link} to="/essentials" size="sm" style={{ flexShrink: 0 }}>
          <Group gap={4} wrap="nowrap">
            <IconSettings size={16} />
            {t('essentials.manage')}
          </Group>
        </Anchor>
      </Group>

      {/* A failed refetch keeps showing the cached list; the error only when there's none. */}
      {data === undefined || items === undefined ? (
        error ? (
          <Text c="red">{error.message}</Text>
        ) : (
          <Stack gap="xs">
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} radius="xl" />
            <Skeleton height={8} radius="xl" />
          </Stack>
        )
      ) : data.length === 0 ? (
        // Nothing to check yet: different from "all good".
        <EmptyState
          icon={<IconListCheck />}
          title={t('buyingList.noEssentialsTitle')}
          description={t('buyingList.noEssentialsText')}
        >
          <EmptyStateActions>
            <Button component={Link} to="/essentials" variant="default">
              {t('essentials.add')}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconCheck />}
          title={t('buyingList.emptyTitle')}
          description={t('buyingList.emptyText')}
        />
      ) : (
        <List>
          {items.map(({ essential, reasons }) => {
            const { title, subtitle } = itemLabels(essential, t);
            return (
              <List.Item key={essential.id}>
                <Group gap="xs">
                  <Text>{title}</Text>
                  {reasons.map((reason) => (
                    <Badge key={reason} color={reasonColor[reason]} variant="light">
                      {t(`common.${reason}`)}
                    </Badge>
                  ))}
                </Group>
                {subtitle && (
                  <Text size="xs" c="dimmed">
                    {subtitle}
                  </Text>
                )}
              </List.Item>
            );
          })}
        </List>
      )}
    </>
  );
};

export default BuyingList;
