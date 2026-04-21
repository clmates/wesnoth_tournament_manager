import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import zhTranslations from './locales/zh.json';
import deTranslations from './locales/de.json';
import ruTranslations from './locales/ru.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    es: { translation: esTranslations },
    zh: { translation: zhTranslations },
    de: { translation: deTranslations },
    ru: { translation: ruTranslations },
  },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  ns: ['translation'],
  defaultNS: 'translation',
  interpolation: {
    escapeValue: false,
  },
  missingKeyHandler: (lngs, ns, key) => {
    console.warn(`Missing translation key: ${key} for languages: ${lngs}`);
    return key;
  },
});

export default i18n;
