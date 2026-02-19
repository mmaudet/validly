import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';
import fr from './locales/fr/common.json';

i18next.use(initReactI18next).init({
  resources: {
    en: { common: en },
    fr: { common: fr },
  },
  lng: navigator.language.startsWith('fr') ? 'fr' : 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'fr'],
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
