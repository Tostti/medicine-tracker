import { useState } from 'react';
import { IconPencil, IconPill, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Popover,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  addExistence,
  deleteExistence,
  type Existence,
  type Medication,
  pictureSrc,
  toISODate,
  updateExistence,
} from '../../api/medications';
import { formatDate } from '../../i18n';

const oneMonthFromToday = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toISODate(d);
};

// Same thresholds as the buying list: within a month counts as "expiring soon".
const expiryStatus = (dueDate: string, t: TFunction) => {
  if (dueDate < toISODate(new Date())) {
    return { label: t('common.expired'), color: 'red' };
  }
  if (dueDate <= oneMonthFromToday()) {
    return { label: t('common.expiringSoon'), color: 'orange' };
  }
  return { label: t('common.valid'), color: 'green' };
};

// Every change to stock affects the home cards, the lists and the detail page:
// they all live under the 'medications' query key.
const useRefreshMedications = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['medications'] });
};

// Fixing a typo in the due date: replaces the row until saved or cancelled.
const EditDueDateForm = ({ existence, onDone }: { existence: Existence; onDone: () => void }) => {
  const { t } = useTranslation();
  const refresh = useRefreshMedications();
  const [dueDate, setDueDate] = useState(existence.due_date);

  const save = useMutation({
    mutationFn: () => updateExistence(existence.id, { due_date: dueDate }),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (dueDate === existence.due_date) {
          onDone(); // nothing changed: no request
        } else if (dueDate) {
          save.mutate();
        }
      }}
    >
      <Group align="start" wrap="wrap" gap="xs">
        <TextInput
          type="date"
          aria-label={t('stock.newDueDate')}
          // Focus lands on the date, so a keyboard user can type right away.
          autoFocus
          style={{ flex: 1, minWidth: 160 }}
          value={dueDate}
          onChange={(e) => setDueDate(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onDone();
            }
          }}
          error={!dueDate ? t('common.dateRequired') : save.error?.message}
        />
        <Group gap="xs" wrap="nowrap" ml="auto">
          <Button variant="default" size="sm" onClick={onDone} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Group>
    </form>
  );
};

const StockRow = ({ existence }: { existence: Existence }) => {
  const { t } = useTranslation();
  const [editingDate, setEditingDate] = useState(false);
  const refresh = useRefreshMedications();
  const [confirmOpened, setConfirmOpened] = useState(false);
  const status = expiryStatus(existence.due_date, t);

  // onSuccess returns the refetch promise, so the mutation stays pending until fresh data
  // arrives: the switch never flickers back to the old value in between.
  const toggleLow = useMutation({
    mutationFn: (low_amount: boolean) => updateExistence(existence.id, { low_amount }),
    onSuccess: refresh,
  });
  const discard = useMutation({
    mutationFn: () => deleteExistence(existence.id),
    onSuccess: refresh,
  });
  const error = toggleLow.error ?? discard.error;

  if (editingDate) {
    return <EditDueDateForm existence={existence} onDone={() => setEditingDate(false)} />;
  }

  return (
    <Stack gap={4}>
      {/* On narrow phones the controls drop to a second line, aligned right, instead of squeezing. */}
      <Group justify="space-between" wrap="wrap" style={{ rowGap: 4 }}>
        <Group gap="sm" wrap="nowrap">
          <Group gap={2} wrap="nowrap">
            <Text fw={500} ff="monospace">
              {formatDate(existence.due_date)}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('stock.fixDate', { date: formatDate(existence.due_date) })}
              disabled={toggleLow.isPending || discard.isPending}
              onClick={() => setEditingDate(true)}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Group>
          <Badge color={status.color} variant="light" style={{ flexShrink: 0 }}>
            {status.label}
          </Badge>
        </Group>
        <Group gap="sm" wrap="nowrap" ml="auto">
          <Switch
            label={t('common.lowAmount')}
            labelPosition="left"
            styles={{ label: { whiteSpace: 'nowrap' } }}
            // While saving (until the refetch ends, see onSuccess), show the new value.
            checked={
              toggleLow.isPending
                ? (toggleLow.variables ?? existence.low_amount)
                : existence.low_amount
            }
            disabled={toggleLow.isPending || discard.isPending}
            onChange={(e) => toggleLow.mutate(e.currentTarget.checked)}
          />
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
                aria-label={t('stock.discardLabel', { date: formatDate(existence.due_date) })}
                loading={discard.isPending}
                onClick={() => setConfirmOpened((o) => !o)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <Text size="sm">
                  {t('stock.discardConfirm', { date: formatDate(existence.due_date) })}
                </Text>
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="default" onClick={() => setConfirmOpened(false)}>
                    {t('common.no')}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    onClick={() => {
                      setConfirmOpened(false);
                      discard.mutate();
                    }}
                  >
                    {t('stock.discard')}
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </Group>
      {error && (
        <Text size="sm" c="red">
          {error.message}
        </Text>
      )}
    </Stack>
  );
};

const AddStockForm = ({ medicationId, onDone }: { medicationId: number; onDone: () => void }) => {
  const { t } = useTranslation();
  const refresh = useRefreshMedications();
  const [dueDate, setDueDate] = useState('');
  const [lowAmount, setLowAmount] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const add = useMutation({
    mutationFn: () => addExistence(medicationId, { due_date: dueDate, low_amount: lowAmount }),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setShowErrors(true);
        if (dueDate) {
          add.mutate();
        }
      }}
    >
      <Stack gap="xs">
        <Group align="start" wrap="wrap" gap="sm">
          <TextInput
            type="date"
            label={t('stock.expiration')}
            data-autofocus
            style={{ flex: 1, minWidth: 160 }}
            value={dueDate}
            onChange={(e) => setDueDate(e.currentTarget.value)}
            error={showErrors && !dueDate && t('common.dateRequired')}
          />
          <Checkbox
            label={t('common.lowAmount')}
            mt={34}
            checked={lowAmount}
            onChange={(e) => setLowAmount(e.currentTarget.checked)}
          />
        </Group>
        {add.error && (
          <Text size="sm" c="red">
            {add.error.message}
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="xs" onClick={onDone} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="xs" loading={add.isPending}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

export const MedicationStockCard = ({ medication }: { medication: Medication }) => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" wrap="nowrap" mb="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar src={pictureSrc(medication.picture_uri)} radius="sm">
            <IconPill />
          </Avatar>
          <Anchor component={Link} to={`/medications/${medication.id}`} fw={600} truncate>
            {medication.commercial_name}
          </Anchor>
        </Group>
        {!adding && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
            style={{ flexShrink: 0 }}
          >
            {t('common.add')}
          </Button>
        )}
      </Group>

      <Stack gap="sm">
        {medication.existences.length === 0 && !adding && (
          <Text c="dimmed">{t('common.noStock')}</Text>
        )}
        {/* The backend returns them sorted by due date. */}
        {medication.existences.map((e, i) => (
          <Stack key={e.id} gap="sm">
            {i > 0 && <Divider />}
            <StockRow existence={e} />
          </Stack>
        ))}
        {adding && (
          <>
            {medication.existences.length > 0 && <Divider />}
            <AddStockForm medicationId={medication.id} onDone={() => setAdding(false)} />
          </>
        )}
      </Stack>
    </Card>
  );
};
