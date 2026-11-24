import {
  ActionIcon,
  Affix,
  AppShell,
  Box,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconHome, IconPackage, IconPill, IconSearch } from '@tabler/icons-react';
import { Outlet, NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { MedicationSearch } from '../components/Search/MedicationSearch';

// Home only on its own address; the rest also on their sub-pages (/medications/5).
const isActive = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

const links = [
  { to: '/', label: 'Home', icon: IconHome },
  { to: '/medications', label: 'Medications', icon: IconPill },
  { to: '/stock', label: 'Stock', icon: IconPackage },
];

export function AppLayout() {
  const { pathname } = useLocation();
  const [searchOpened, search] = useDisclosure(false);

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={{ height: { base: 64, sm: 0 } }}
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Medicine Tracker</Title>
        </Group>
      </AppShell.Header>

      {/* Desktop: sidebar */}
      <AppShell.Navbar p="md">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={RouterNavLink}
            to={to}
            label={label}
            leftSection={<Icon size={18} />}
            active={isActive(pathname, to)}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
        {/* Room to scroll the end of a page clear of the floating search button (56px + 20px gap). */}
        <Box h={80} />
      </AppShell.Main>

      {/* Mobile: bottom tab bar */}
      <AppShell.Footer hiddenFrom="sm">
        <Group h="100%" grow gap={0}>
          {links.map(({ to, label, icon: Icon }) => {
            const active = isActive(pathname, to);
            return (
              <UnstyledButton key={to} component={RouterNavLink} to={to} h="100%">
                <Stack
                  align="center"
                  justify="center"
                  gap={2}
                  h="100%"
                  c={active ? 'blue' : 'dimmed'}
                >
                  <Icon size={24} />
                  <Text size="xs">{label}</Text>
                </Stack>
              </UnstyledButton>
            );
          })}
        </Group>
      </AppShell.Footer>

      {/* Floating search button: sits above the tab bar on mobile */}
      <Affix
        position={{ right: 20, bottom: 'calc(var(--app-shell-footer-offset, 0rem) + 20px)' }}
      >
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          aria-label="Buscar medicamento"
          onClick={search.open}
        >
          <IconSearch size={28} />
        </ActionIcon>
      </Affix>

      <MedicationSearch opened={searchOpened} onClose={search.close} />
    </AppShell>
  );
}
