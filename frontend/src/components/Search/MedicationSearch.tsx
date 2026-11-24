import { useState } from 'react';
import { Button, EmptyState, EmptyStateActions, Loader, Modal, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchMedications } from '../../api/medications';
import { MedicationItem } from '../Medications/MedicationItem';

const MIN_CHARS = 2;

interface MedicationSearchProps {
  opened: boolean;
  onClose: () => void;
}

export const MedicationSearch = ({ opened, onClose }: MedicationSearchProps) => {
  const [search, setSearch] = useState('');
  // Wait until typing pauses so every keystroke doesn't fire a request.
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const enabled = debounced.length >= MIN_CHARS;

  const { data, error, isFetching } = useQuery({
    // Each search term is cached on its own, under the medications prefix.
    queryKey: ['medications', 'search', debounced],
    queryFn: () => fetchMedications({q:debounced}),
    enabled,
    // Keep showing the previous results while the next ones load, instead of flashing empty.
    placeholderData: keepPreviousData,
  });

  const navigate = useNavigate();

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  // Leave the modal and go to a page (a result's detail, or the creation form).
  const goTo = (path: string) => {
    handleClose();
    void navigate(path);
  };
  const addNew = () => goTo(`/medications/new?nombre=${encodeURIComponent(debounced)}`);

  return (
    <Modal opened={opened} onClose={handleClose} title="Buscar medicamento">
      <Stack>
        <TextInput
          data-autofocus
          placeholder="Nombre, droga, acción o tipo"
          leftSection={<IconSearch size={16} />}
          rightSection={isFetching ? <Loader size="xs" /> : null}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {!enabled ? (
          <Text size="sm" c="dimmed">
            Escribí al menos {MIN_CHARS} letras
          </Text>
        ) : error ? (
          <Text c="red">{error.message}</Text>
        ) : data?.length === 0 ? (
          <EmptyState 
        description={`No se encontró nada para ${debounced}`}>
            <EmptyStateActions>
              <Button variant="default" leftSection={<IconPlus size={16} />} onClick={addNew}>
                Agregar medicamento
              </Button>
            </EmptyStateActions>
          </EmptyState>
        ) : (<>
          {data?.map((m) => (
            <UnstyledButton key={m.id} onClick={() => goTo(`/medications/${m.id}`)}>
              <MedicationItem medication={m} showStock />
            </UnstyledButton>
          ))}
          <Button variant="subtle" leftSection={<IconPlus size={16} />} onClick={addNew} style={{ alignSelf: 'start' }}>
            {`Agregar nuevo medicamento "${debounced}"`}
          </Button>
        </>
        )}
      </Stack>
    </Modal>
  );
};
