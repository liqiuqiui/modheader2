import "i18next";
import type { resources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    strictKeyChecks: true;
    resources: {
      translation: (typeof resources)["zh-CN"]["translation"];
    };
  }
}
