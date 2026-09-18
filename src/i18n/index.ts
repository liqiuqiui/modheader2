import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultLocale, supportedLocales } from "../config/locales";
import { bindDocumentLanguage } from "./document-language";
import { storageLanguageDetector, watchStoredLocale } from "./language-detector";
import { resources } from "./resources";

let initialization: Promise<typeof i18n> | undefined;
let integrationsBound = false;

function bindIntegrations() {
  if (integrationsBound) return;
  integrationsBound = true;
  watchStoredLocale(i18n);
  bindDocumentLanguage(i18n);
}

export function initializeI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) return Promise.resolve(i18n);
  if (initialization) return initialization;

  initialization = i18n
    .use(storageLanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: defaultLocale,
      supportedLngs: [...supportedLocales],
      defaultNS: "translation",
      returnNull: false,
      initAsync: false,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
    .then(() => {
      bindIntegrations();
      return i18n;
    })
    .catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });

  return initialization;
}

export default i18n;
