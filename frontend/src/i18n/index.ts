import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { es } from './locales/es';

const resources = { en: { translation: en }, es: { translation: es } };

// t('...') keys (and their plurals) are checked against the English file.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: (typeof resources)['en'];
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['en', 'es'],
    // 'es-AR', 'es-ES'... are accepted and served by 'es'.
    nonExplicitSupportedLngs: true,
    // Any other device language.
    fallbackLng: 'en',
    detection: {
      // Only the device's languages (navigator.languages, in order of preference),
      // and nothing remembered between visits.
      order: ['navigator'],
      caches: [],
    },
    // React already escapes what it renders.
    interpolation: { escapeValue: false },
    // Resources are bundled, so init finishes synchronously and the first render is translated.
    initAsync: false,
  });

// Screen readers and the browser (hyphenation, spellcheck) read the page's language from <html lang>.
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

// i18n.language keeps the device's full tag when it's supported ('es-AR', 'en-GB'),
// so dates follow the regional format; an unsupported device language becomes 'en'.
export const locale = () => i18n.language;

// "YYYY-MM-DD" parsed as a local date (new Date("YYYY-MM-DD") would be UTC midnight).
export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (iso: string) =>
  parseISODate(iso).toLocaleDateString(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export default i18n;
