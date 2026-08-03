export const supportedLocales = ["zh-CN", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "zh-CN";

export function isSupportedLocale(language: string | undefined): language is Locale {
  return supportedLocales.some((locale) => locale === language);
}
