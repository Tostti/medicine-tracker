import { useTranslation } from 'react-i18next';
import { Text, type TextProps } from '@mantine/core';

// Baked in at build time (see the Dockerfile); a local build or `yarn dev` says "dev".
const VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

/** Which version is running, to tell from a phone what the server has deployed. */
export function AppVersion(props: TextProps) {
  const { t } = useTranslation();
  return (
    <Text size="xs" c="dimmed" {...props}>
      {t('version', { version: VERSION })}
    </Text>
  );
}
