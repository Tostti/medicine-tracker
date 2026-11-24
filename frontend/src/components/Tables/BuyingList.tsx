import { IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, EmptyState, Group, List, Skeleton, Stack, Text, Title } from '@mantine/core';
import { fetchMedications, type Medication, toISODate } from '../../api/medications';

type BuyingReason = 'noStock' | 'expired' | 'lowAmount' | 'expiringSoon';

interface BuyingItem {
  medication: Medication;
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

const getBuyingReasons = (m: Medication, today: string, limit: string): BuyingReason[] => {
  if (m.existences.length === 0) {
    return ['noStock'];
  }

  // Expired existences don't count as stock: only the valid ones are checked below.
  const valid = m.existences.filter((e) => e.due_date >= today);
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

const toBuyingList = (medications: Medication[]): BuyingItem[] => {
  const today = toISODate(new Date());
  const limit = oneMonthFromToday();
  return medications.flatMap((medication) => {
    const reasons = getBuyingReasons(medication, today, limit);
    return reasons.length > 0 ? [{ medication, reasons }] : [];
  });
};

const filters = { common_use: true };

const BuyingList = () => {
  const { t } = useTranslation();
  const { isPending, error, data } = useQuery({
    queryKey: ['medications', filters],
    queryFn: () => fetchMedications(filters),
    select: toBuyingList,
  });

  return (
    <>
      <Title order={3} mb="md">
        {t('buyingList.title')}
      </Title>

      {isPending ? (
        <Stack gap="xs">
          <Skeleton height={8} radius="xl" />
          <Skeleton height={8} radius="xl" />
          <Skeleton height={8} radius="xl" />
          <Skeleton height={8} radius="xl" />
        </Stack>
      ) : error ? (
        <Text c="red">{error.message}</Text>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<IconCheck />}
          title={t('buyingList.emptyTitle')}
          description={t('buyingList.emptyText')}
        />
      ) : (
        <List>
          {data.map(({ medication, reasons }) => (
            <List.Item key={medication.id}>
              <Group gap="xs">
                <Text>{medication.commercial_name}</Text>
                {reasons.map((reason) => (
                  <Badge key={reason} color={reasonColor[reason]} variant="light">
                    {t(`common.${reason}`)}
                  </Badge>
                ))}
              </Group>
            </List.Item>
          ))}
        </List>
      )}
    </>
  );
};

export default BuyingList;
