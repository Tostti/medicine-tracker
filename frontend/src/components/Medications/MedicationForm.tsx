import { type SubmitEvent, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Avatar,
  Button,
  Checkbox,
  FileInput,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPhoto, IconPill, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { fetchDrugs, type Medication, pictureSrc } from '../../api/medications';

// Each dynamic row has a key of its own so React keeps inputs in place when one is removed.
let nextKey = 0;
const newKey = () => String(nextKey++);

interface DrugRow {
  key: string;
  name: string;
  dose: string;
}

interface ExistenceRow {
  key: string;
  due_date: string;
  low_amount: boolean;
}

export interface MedicationFormValues {
  commercial_name: string;
  type: string;
  function: string;
  common_use: boolean;
  picture: File | null;
  drugs: { name: string; dose: string }[];
  existences: { due_date: string; low_amount: boolean }[];
}

interface MedicationFormProps {
  // Editing: start from this medication. Creating: start empty.
  medication?: Medication;
  // Creating from a search with no results: start with the name that was searched.
  initialName?: string;
  submitLabel: string;
  onSubmit: (values: MedicationFormValues) => Promise<void>;
  onCancel: () => void;
}

const emptyDrug = (): DrugRow => ({ key: newKey(), name: '', dose: '' });
const emptyExistence = (): ExistenceRow => ({ key: newKey(), due_date: '', low_amount: false });

export const MedicationForm = ({
  medication,
  initialName = '',
  submitLabel,
  onSubmit,
  onCancel,
}: MedicationFormProps) => {
  const editing = medication !== undefined;

  const [name, setName] = useState(medication?.commercial_name ?? initialName);
  const [type, setType] = useState(medication?.type ?? '');
  const [fn, setFn] = useState(medication?.function ?? '');
  const [commonUse, setCommonUse] = useState(medication?.common_use ?? false);
  const [picture, setPicture] = useState<File | null>(null);
  const [drugs, setDrugs] = useState<DrugRow[]>(() =>
    medication && medication.drugs.length > 0
      ? medication.drugs.map((d) => ({ key: newKey(), name: d.drug.name, dose: d.dose }))
      : [emptyDrug()],
  );
  // First stock only when creating: afterwards, stock is managed in the Stock tab.
  const [existences, setExistences] = useState<ExistenceRow[]>([]);

  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Preview of the chosen file; the temporary URL is released when the file changes.
  const previewUrl = useMemo(() => (picture ? URL.createObjectURL(picture) : null), [picture]);
  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );
  const currentPicture = previewUrl ?? pictureSrc(medication?.picture_uri ?? null);

  const { data: knownDrugs } = useQuery({ queryKey: ['drugs'], queryFn: fetchDrugs });
  const drugSuggestions = (knownDrugs ?? []).map((d) => d.name);

  const updateDrug = (key: string, change: Partial<DrugRow>) =>
    setDrugs((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const updateExistence = (key: string, change: Partial<ExistenceRow>) =>
    setExistences((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));

  // A completely empty drug row is just ignored; a half-filled one is an error.
  const filledDrugs = drugs.filter((d) => d.name.trim() || d.dose.trim());
  const nameError = name.trim() ? null : 'Ingresá el nombre';
  const drugError = (d: DrugRow) => ({
    name: !d.name.trim() && d.dose.trim() ? 'Falta la droga' : null,
    dose: !d.dose.trim() && d.name.trim() ? 'Falta la dosis' : null,
  });
  const duplicatedDrug = (d: DrugRow) =>
    d.name.trim() !== '' &&
    filledDrugs.filter((o) => o.name.trim().toLowerCase() === d.name.trim().toLowerCase()).length > 1;
  const valid =
    !nameError &&
    filledDrugs.every((d) => !drugError(d).name && !drugError(d).dose && !duplicatedDrug(d)) &&
    existences.every((e) => e.due_date);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    if (!valid) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        commercial_name: name.trim(),
        type: type.trim(),
        function: fn.trim(),
        common_use: commonUse,
        picture,
        drugs: filledDrugs.map((d) => ({ name: d.name.trim(), dose: d.dose.trim() })),
        existences: existences.map(({ due_date, low_amount }) => ({ due_date, low_amount })),
      });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <Stack gap="sm">
          <TextInput
            label="Nombre comercial"
            placeholder="Tafirol 1G x 50"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            error={showErrors && nameError}
          />
          <TextInput
            label="Tipo"
            placeholder="Comprimidos, jarabe, crema…"
            value={type}
            onChange={(e) => setType(e.currentTarget.value)}
          />
          <TextInput
            label="Función"
            placeholder="Analgésico, antifebril…"
            value={fn}
            onChange={(e) => setFn(e.currentTarget.value)}
          />
          <Group align="end" wrap="nowrap">
            <Avatar src={currentPicture} size={56} radius="md">
              <IconPill />
            </Avatar>
            <FileInput
              style={{ flex: 1 }}
              label="Foto"
              placeholder={editing && medication.picture_uri ? 'Cambiar foto' : 'Elegir una foto'}
              accept="image/*"
              leftSection={<IconPhoto size={16} />}
              clearable
              value={picture}
              onChange={setPicture}
            />
          </Group>
          <Switch
            label="De uso habitual"
            description="Se tiene en cuenta para la lista de compra"
            checked={commonUse}
            onChange={(e) => setCommonUse(e.currentTarget.checked)}
          />
        </Stack>

        <Stack gap="xs">
          <Title order={4}>Composición</Title>
          {drugs.map((d) => {
            const errors = drugError(d);
            return (
              <Group key={d.key} align="start" wrap="nowrap" gap="xs">
                <Autocomplete
                  style={{ flex: 2 }}
                  aria-label="Droga"
                  placeholder="Droga"
                  data={drugSuggestions}
                  value={d.name}
                  onChange={(value) => updateDrug(d.key, { name: value })}
                  error={showErrors && (errors.name ?? (duplicatedDrug(d) ? 'Repetida' : null))}
                />
                <TextInput
                  style={{ flex: 1 }}
                  aria-label="Dosis"
                  placeholder="Dosis"
                  value={d.dose}
                  onChange={(e) => updateDrug(d.key, { dose: e.currentTarget.value })}
                  error={showErrors && errors.dose}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label="Quitar droga"
                  onClick={() => setDrugs((rows) => rows.filter((r) => r.key !== d.key))}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            );
          })}
          <Button
            variant="subtle"
            leftSection={<IconPlus size={16} />}
            onClick={() => setDrugs((rows) => [...rows, emptyDrug()])}
            style={{ alignSelf: 'start' }}
          >
            Agregar droga
          </Button>
        </Stack>

        {!editing && (
          <Stack gap="xs">
            <Title order={4}>Stock inicial</Title>
            <Text size="sm" c="dimmed">
              Opcional: las unidades que ya tenés, con su vencimiento.
            </Text>
            {existences.map((e) => (
              <Group key={e.key} align="center" wrap="nowrap" gap="xs">
                <TextInput
                  style={{ flex: 1 }}
                  type="date"
                  aria-label="Vencimiento"
                  value={e.due_date}
                  onChange={(ev) => updateExistence(e.key, { due_date: ev.currentTarget.value })}
                  error={showErrors && !e.due_date && 'Falta la fecha'}
                />
                <Checkbox
                  label="Queda poco"
                  checked={e.low_amount}
                  onChange={(ev) => updateExistence(e.key, { low_amount: ev.currentTarget.checked })}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label="Quitar"
                  onClick={() => setExistences((rows) => rows.filter((r) => r.key !== e.key))}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="subtle"
              leftSection={<IconPlus size={16} />}
              onClick={() => setExistences((rows) => [...rows, emptyExistence()])}
              style={{ alignSelf: 'start' }}
            >
              Agregar vencimiento
            </Button>
          </Stack>
        )}

        {submitError && (
          <Alert color="red" title="No se pudo guardar">
            {submitError}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};
