import { defineConfig } from "wxt";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  alias: {
    "@": path.resolve(__dirname, "src"),
  },
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
  }),
  manifest: {
    default_locale: "zh_CN",
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    // 不写死版本：WXT 默认取 package.json 的 version，便于 CI 按 tag 打版本
    permissions: [
      "storage",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess",
      "webRequest",
      "tabs",
      "tabGroups",
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
