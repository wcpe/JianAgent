import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { zhCN } from './zh-CN.js';

const resources = {
  'zh-CN': { translation: zhCN },
} as const;

const savedLang = localStorage.getItem('language') ?? 'zh-CN';

i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
});

export default i18n;
