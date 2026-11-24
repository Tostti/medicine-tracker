import { render as testingLibraryRender } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
// jsdom reports an English browser ('en-US'), so tests render the English texts.
import '../src/i18n';
import { theme } from '../src/theme';

export function render(ui: React.ReactNode) {
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider theme={theme} env="test">
        {children}
      </MantineProvider>
    ),
  });
}
