import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

const enResources: typeof zhCN = en;

export const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: enResources },
} as const;
