import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({/** Put your mantine theme override here */});

// Mantine's default "dimmed" text fails WCAG AA (4.5:1) for normal-size text:
// gray-6 on white is 3.32, dark-2 on the dark background is 4.04.
// These keep at least 4.5:1 also on the hover/pressed backgrounds of clickable rows
// (light: 6.09 on white, 5.14 on gray-2 · dark: 6.38 on dark-7, 4.60 on dark-5).
//
// Same problem with the text of "light" badges/buttons in light mode: even Mantine's darkest
// shade (9) is below 4.5:1 on its own tinted background for green (3.81), orange (3.62) and
// yellow (2.69). These are shade 9 darkened just enough to pass (4.66, 4.73, 4.75).
// Red (4.51), blue (4.93) and gray already pass; dark mode passes for all (above 10:1).
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': '#5c636a',
    '--mantine-color-green-light-color': '#267a37',
    '--mantine-color-orange-light-color': '#b93d0d',
    '--mantine-color-yellow-light-color': '#a65600',
  },
  dark: { '--mantine-color-dimmed': '#a6a6a6' },
});
