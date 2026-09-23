import type { Browser } from "wxt/browser";

/** 浏览器标签页数据，供标签页 hook 与 UI 组件共享。 */
export type BrowserTab = Browser.tabs.Tab;

/** 浏览器标签组数据，用于把 Tab 组筛选器的 ID 展示成组名称。 */
export type BrowserTabGroup = Browser.tabGroups.TabGroup;
