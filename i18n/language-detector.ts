import type { i18n as I18nInstance, LanguageDetectorAsyncModule } from "i18next";
import { defaultLocale, isSupportedLocale } from "../config/locales";
import { localeStorage } from "./locale-storage";

export const storageLanguageDetector: LanguageDetectorAsyncModule = {
  type: "languageDetector",
  async: true,
  async detect() {
    const locale = await localeStorage.getValue();
    return isSupportedLocale(locale) ? locale : defaultLocale;
  },
  async cacheUserLanguage(language) {
    if (isSupportedLocale(language)) {
      await localeStorage.setValue(language);
    }
  },
};

export function watchStoredLocale(i18n: I18nInstance): () => void {
  return localeStorage.watch((nextLocale) => {
    const locale = nextLocale ?? defaultLocale;
    if (i18n.resolvedLanguage !== locale) {
      void i18n.changeLanguage(locale);
    }
  });
}
