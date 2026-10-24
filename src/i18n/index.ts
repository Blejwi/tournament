import i18n, { type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { EngineError } from '@/engine';
import { en } from './en';
import { pl } from './pl';

export const LANGUAGES = ['en', 'pl'] as const;
export type Language = (typeof LANGUAGES)[number];

const LANGUAGE_KEY = 'tm:language';

function savedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return (LANGUAGES as readonly string[]).includes(saved ?? '') ? (saved as Language) : 'pl';
  } catch {
    return 'pl';
  }
}

export function setLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
  document.title = i18n.t('app.title');
});

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  showSupportNotice: false,
  interpolation: { escapeValue: false }, // React already escapes
});

/** Translates a typed engine error. Its data fields (e.g. `number`) are available to the message. */
export function errorMessage(t: TFunction, error: EngineError): string {
  return t(`errors.${error.code}`, error);
}

export default i18n;
