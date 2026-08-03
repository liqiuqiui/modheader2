import { defineConfig } from "wxt";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      port: 3003,
      strictPort: true,
    },
  },
  webExt: {
    disabled: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname),
      },
    },
  }),
  manifest: {
    default_locale: "zh_CN",
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    version: "1.0.0",
    permissions: [
      "storage",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess",
      "tabs",
      "scripting",
      "contextMenus",
      "alarms",
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_popup: "popup.html",
      default_title: "__MSG_extensionName__",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
