import { IconAlertTriangle, IconMapPinOff } from '@tabler/icons-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { Button, Center, Code, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';

export function ErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const Icon = notFound ? IconMapPinOff : IconAlertTriangle;

  // Only for an unexpected crash: helps to tell what broke.
  const detail = !notFound && error instanceof Error ? error.message : null;

  return (
    <Center py="xl">
      <Stack align="center" gap="md" maw={480}>
        <ThemeIcon size={64} radius="xl" variant="light" color={notFound ? 'gray' : 'red'}>
          <Icon size={36} />
        </ThemeIcon>
        <Title order={2} ta="center">
          {notFound ? 'Página no encontrada' : 'Algo salió mal'}
        </Title>
        <Text c="dimmed" ta="center">
          {notFound
            ? 'La dirección que abriste no existe.'
            : 'Ocurrió un error inesperado al mostrar esta página.'}
        </Text>
        {detail && <Code block>{detail}</Code>}
        <Group>
          {!notFound && (
            <Button variant="default" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          )}
          <Button component={Link} to="/">
            Ir al inicio
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
