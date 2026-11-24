import i18n, { formatDate } from '.';

// Detect from a fake device, the way the app does on startup.
const useDeviceLanguages = async (languages: string[]) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  await i18n.changeLanguage(i18n.services.languageDetector.detect());
};

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en-US');
});

describe('i18n', () => {
  it('uses Spanish for any regional Spanish', async () => {
    await useDeviceLanguages(['es-AR']);

    expect(i18n.resolvedLanguage).toBe('es');
    expect(i18n.t('nav.home')).toBe('Inicio');
  });

  it('falls back to English for an unsupported language', async () => {
    await useDeviceLanguages(['fr-FR']);

    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('nav.home')).toBe('Home');
  });

  it('picks the first supported language among the device preferences', async () => {
    await useDeviceLanguages(['fr-FR', 'es-AR', 'en-US']);

    expect(i18n.resolvedLanguage).toBe('es');
  });

  it('formats dates in the device’s regional format', async () => {
    await useDeviceLanguages(['es-AR']);
    expect(formatDate('2026-11-20')).toBe('20/11/2026');

    await useDeviceLanguages(['en-US']);
    expect(formatDate('2026-11-20')).toBe('11/20/2026');
  });

  it('pluralizes', () => {
    expect(i18n.t('expirations.days', { count: 1 })).toBe('1 day');
    expect(i18n.t('expirations.days', { count: 3 })).toBe('3 days');
    expect(i18n.t('expirations.daysAgo', { lng: 'es', count: 1 })).toBe('hace 1 día');
  });
});
