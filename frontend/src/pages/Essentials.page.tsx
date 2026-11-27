import { type SubmitEvent, useState } from 'react';
import { IconListCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Autocomplete,
  Button,
  Card,
  EmptyState,
  Group,
  Popover,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  compositionLabel,
  createEssential,
  deleteEssential,
  type EssentialDetail,
  essentialsQueryKey,
  fetchEssentials,
} from '../api/essentials';
import { fetchDrugs } from '../api/medications';

// Refreshes the essentials, the shopping list and the "Essential" filter at once.
const useRefresh = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['medications'] });
};

const EssentialCard = ({ essential }: { essential: EssentialDetail }) => {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const [confirmOpened, setConfirmOpened] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteEssential(essential.id),
    onSuccess: refresh,
  });
  const composition = compositionLabel(essential.drugs);

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" wrap="nowrap" align="start">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text fw={600}>{composition}</Text>
          {essential.medications.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('essentials.noBrands')}
            </Text>
          ) : (
            <Group gap="xs">
              {essential.medications.map((m) => (
                <Anchor key={m.id} component={Link} to={`/medications/${m.id}`} size="sm">
                  {m.commercial_name}
                </Anchor>
              ))}
            </Group>
          )}
          {remove.error && (
            <Text size="sm" c="red">
              {remove.error.message}
            </Text>
          )}
        </Stack>
        <Popover
          opened={confirmOpened}
          onChange={setConfirmOpened}
          position="bottom-end"
          withArrow
          shadow="md"
        >
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              color="red"
              size="lg"
              aria-label={t('essentials.removeLabel', { composition })}
              loading={remove.isPending}
              onClick={() => setConfirmOpened((o) => !o)}
            >
              <IconTrash size={18} />
            </ActionIcon>
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
                    remove.mutate();
                  }}
                >
                  {t('essentials.stopKeeping')}
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </Card>
  );
};

// Each row has a key of its own so React keeps inputs in place when one is removed.
let nextKey = 0;
const emptyRow = () => ({ key: String(nextKey++), name: '', dose: '' });

// Usually one drug ("Ibuprofeno 600 mg"); more rows for a combination product.
const AddEssentialForm = ({ onDone }: { onDone: () => void }) => {
  const { t } = useTranslation();
  const refresh = useRefresh();
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [showErrors, setShowErrors] = useState(false);
  const { data: knownDrugs } = useQuery({ queryKey: ['drugs'], queryFn: fetchDrugs });

  const add = useMutation({
    mutationFn: () =>
      createEssential(rows.map((r) => ({ name: r.name.trim(), dose: r.dose.trim() }))),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  const update = (key: string, change: { name?: string; dose?: string }) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const repeated = (name: string) =>
    name.trim() !== '' &&
    rows.filter((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase()).length > 1;
  const valid = rows.every((r) => r.name.trim() && r.dose.trim() && !repeated(r.name));

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    if (valid) {
      add.mutate();
    }
  };

  return (
    <Card withBorder radius="md" padding="md">
      <form noValidate onSubmit={handleSubmit}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t('essentials.addHelp')}
          </Text>
          {rows.map((r) => (
            <Group key={r.key} align="start" gap="xs" wrap="nowrap">
              <Autocomplete
                aria-label={t('form.drug')}
                placeholder={t('form.drug')}
                data={(knownDrugs ?? []).map((d) => d.name)}
                value={r.name}
                onChange={(name) => update(r.key, { name })}
                error={
                  showErrors &&
                  (!r.name.trim()
                    ? t('form.drugRequired')
                    : repeated(r.name)
                      ? t('form.duplicated')
                      : null)
                }
                style={{ flex: 2 }}
                data-autofocus
              />
              <TextInput
                aria-label={t('form.dose')}
                placeholder="600 mg"
                value={r.dose}
                onChange={(e) => update(r.key, { dose: e.currentTarget.value })}
                error={showErrors && !r.dose.trim() && t('form.doseRequired')}
                style={{ flex: 1 }}
              />
              {rows.length > 1 && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={t('form.removeDrug')}
                  onClick={() => setRows((all) => all.filter((o) => o.key !== r.key))}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
          ))}
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setRows((all) => [...all, emptyRow()])}
            style={{ alignSelf: 'start' }}
          >
            {t('form.addDrug')}
          </Button>
          {add.error && (
            <Text size="sm" c="red">
              {add.error.message}
            </Text>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onDone} disabled={add.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={add.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};

export function EssentialsPage() {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const { data, error } = useQuery({ queryKey: essentialsQueryKey, queryFn: fetchEssentials });

  let content;
  if (data === undefined) {
    content = error ? (
      <Text c="red">{error.message}</Text>
    ) : (
      <Stack gap="sm">
        <Skeleton height={64} radius="md" />
        <Skeleton height={64} radius="md" />
      </Stack>
    );
  } else if (data.length === 0 && !adding) {
    content = (
      <EmptyState
        icon={<IconListCheck />}
        title={t('buyingList.noEssentialsTitle')}
        description={t('essentials.emptyText')}
      />
    );
  } else {
    content = (
      <Stack gap="sm">
        {data.map((e) => (
          <EssentialCard key={e.id} essential={e} />
        ))}
      </Stack>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Title order={2}>{t('essentials.title')}</Title>
        {!adding && (
          <Button leftSection={<IconPlus size={18} />} onClick={() => setAdding(true)}>
            {t('common.add')}
          </Button>
        )}
      </Group>
      <Text c="dimmed" size="sm" mb="md">
        {t('essentials.intro')}
      </Text>
      <Stack gap="sm">
        {adding && <AddEssentialForm onDone={() => setAdding(false)} />}
        {content}
      </Stack>
    </>
  );
}
