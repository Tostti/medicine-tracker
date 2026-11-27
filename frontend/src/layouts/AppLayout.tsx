import { IconHome, IconPackage, IconPill, IconSearch, IconStar } from '@tabler/icons-react';
import { Trans, useTranslation } from 'react-i18next';
import { Outlet, NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import {
  ActionIcon,
  Affix,
  Anchor,
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
import { AppVersion } from '../components/AppVersion/AppVersion';
import { OfflineBanner } from '../components/Offline/OfflineBanner';
import { MedicationSearch } from '../components/Search/MedicationSearch';
import classes from './AppLayout.module.css';

// Home only on its own address; the rest also on their sub-pages (/medications/5).
const isActive = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

const links = [
  { to: '/', label: 'nav.home', icon: IconHome },
  { to: '/medications', label: 'nav.medications', icon: IconPill },
  { to: '/stock', label: 'nav.stock', icon: IconPackage },
  // The same star as "Always keep…" on a medication's page.
  { to: '/essentials', label: 'nav.essentials', icon: IconStar },
] as const;

export function AppLayout() {
  const { t } = useTranslation();
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
        <Group h="100%" px="md" gap="sm">
          <span className={classes.logo} aria-hidden />
          <Title order={3} className="trim-to-caps">
            Medicine Tracker
          </Title>
        </Group>
      </AppShell.Header>

      {/* Desktop: sidebar */}
      <AppShell.Navbar p="md">
        <Stack h="100%" gap={0}>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              component={RouterNavLink}
              to={to}
              label={t(label)}
              leftSection={<Icon size={18} />}
              active={isActive(pathname, to)}
            />
          ))}
          {/* Required by the icon's CC BY 4.0 license */}
          <Text size="xs" c="dimmed" mt="auto">
            <Trans
              i18nKey="credit"
              components={{
                site: (
                  <Anchor
                    href="https://icon-icons.com/authors/353-vaadin"
                    target="_blank"
                    inherit
                  />
                ),
                license: (
                  <Anchor
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    inherit
                  />
                ),
              }}
            />
          </Text>
          <AppVersion mt="xs" />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <OfflineBanner />
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
                  <Text size="xs">{t(label)}</Text>
                </Stack>
              </UnstyledButton>
            );
          })}
        </Group>
      </AppShell.Footer>

      {/* Floating search button: sits above the tab bar on mobile */}
      <Affix position={{ right: 20, bottom: 'calc(var(--app-shell-footer-offset, 0rem) + 20px)' }}>
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          aria-label={t('nav.search')}
          onClick={search.open}
        >
          <IconSearch size={28} />
        </ActionIcon>
      </Affix>

      <MedicationSearch opened={searchOpened} onClose={search.close} />
    </AppShell>
  );
}
