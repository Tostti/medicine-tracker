import { Card, SimpleGrid } from '@mantine/core';
import BuyingList from '../components/Tables/BuyingList';
import { ExpiredList, NextExpirations } from '../components/Tables/Expirations';

export function HomePage() {
  return (
    // Stacked on mobile, two per row from sm, all three side by side from lg.
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <Card withBorder radius="md" padding="lg">
        <BuyingList />
      </Card>
      <Card withBorder radius="md" padding="lg">
        <NextExpirations />
      </Card>
      <Card withBorder radius="md" padding="lg">
        <ExpiredList />
      </Card>
    </SimpleGrid>
  );
}
