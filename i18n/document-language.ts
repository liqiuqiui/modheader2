import type { i18n as I18nInstance } from "i18next";
import { isSupportedLocale } from "../config/locales";

export function bindDocumentLanguage(i18n: I18nInstance): () => void {
  if (typeof document === "undefined") return () => undefined;

  const sync = (language: string) => {
    if (!isSupportedLocale(language)) return;
    document.documentElement.lang = language;
    document.documentElement.dir = i18n.dir(language);
  };

  sync(i18n.resolvedLanguage ?? i18n.language);
  i18n.on("languageChanged", sync);

  return () => i18n.off("languageChanged", sync);
}
