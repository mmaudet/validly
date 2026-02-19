import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initI18n() {
  await i18next.use(Backend).init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr'],
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },
    interpolation: {
      escapeValue: false,
    },
  });

  return i18next;
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}

export function tWithLang(lng: string, key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, { ...options, lng });
}

export { i18next };
