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
    // `host_permissions: <all_urls>` already covers cross-origin redirects and
    // header edits, so the extra `declarativeNetRequestWithHostAccess` is only
    // an install-time warning. `scripting` is unused.
    permissions: [
      "storage",
      "declarativeNetRequest",
      "webRequest",
      "tabs",
      "tabGroups",
      "contextMenus",
      "alarms",
    ],
    host_permissions: ["<all_urls>"],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png",
    },
    action: {
      default_popup: "popup.html",
      default_title: "__MSG_extensionName__",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
