import { useState } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Group, Popover, Stack, Text } from '@mantine/core';
import {
  compositionLabel,
  createEssential,
  deleteEssential,
  essentialOf,
  essentialsQueryKey,
  fetchEssentials,
} from '../../api/essentials';
import type { Medication } from '../../api/medications';

/**
 * On a medication's page: whether its composition is an essential, and a way to make it
 * one (or stop). Acts on the composition, not on this brand: removing it also affects
 * every other brand with the same drugs and doses, so it asks first.
 */
export const EssentialControl = ({ medication }: { medication: Medication }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmOpened, setConfirmOpened] = useState(false);
  const { data } = useQuery({ queryKey: essentialsQueryKey, queryFn: fetchEssentials });

  // Refreshes the essentials, the shopping list and the "Essential" filter at once.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['medications'] });
  const add = useMutation({
    mutationFn: () =>
      createEssential(medication.drugs.map((d) => ({ drug_id: d.drug.id, dose: d.dose }))),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: deleteEssential, onSuccess: refresh });
  const error = add.error ?? remove.error;

  if (data === undefined) {
    return null;
  }
  const essential = essentialOf(data, medication.id);
  const composition = compositionLabel(medication.drugs);

  return (
    <Stack gap={4} align="start">
      {essential ? (
        <Group gap="xs">
          <Badge variant="light" leftSection={<IconStarFilled size={12} />}>
            {t('essentials.essential')}
          </Badge>
          <Popover
            opened={confirmOpened}
            onChange={setConfirmOpened}
            position="bottom-start"
            withArrow
            shadow="md"
          >
            <Popover.Target>
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                loading={remove.isPending}
                onClick={() => setConfirmOpened((o) => !o)}
              >
                {t('essentials.stopKeeping')}
              </Button>
            </Popover.Target>
            <Popover.Dropdown maw={280}>
              <Stack gap="xs">
                <Text size="sm">{t('essentials.stopKeepingConfirm', { composition })}</Text>
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="default" onClick={() => setConfirmOpened(false)}>
                    {t('common.no')}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    onClick={() => {
                      setConfirmOpened(false);
                      remove.mutate(essential.id);
                    }}
                  >
                    {t('essentials.stopKeeping')}
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      ) : medication.drugs.length === 0 ? (
        // An essential is a composition, so a medication without one can't be marked.
        <Text size="xs" c="dimmed">
          {t('essentials.needsComposition')}
        </Text>
      ) : (
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconStar size={14} />}
          loading={add.isPending}
          onClick={() => add.mutate()}
        >
          {t('essentials.alwaysKeep', { composition })}
        </Button>
      )}
      {error && (
        <Text size="xs" c="red">
          {error.message}
        </Text>
      )}
    </Stack>
  );
};
