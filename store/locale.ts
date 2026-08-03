import { storage } from "wxt/utils/storage";
import { defaultLocale, type Locale } from "../config/locales";

export const localeStorage = storage.defineItem<Locale>("local:locale", {
  defaultValue: defaultLocale,
});
