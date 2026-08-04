import { browser } from "wxt/browser";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { BrowserTab } from "../../../types/browser";

interface BrowserTabsState {
  tabs: BrowserTab[];
  currentTabId?: number;
}

function sortBrowserTabs(tabs: BrowserTab[], currentTabId?: number) {
  return [...tabs].sort(
    (left, right) =>
      Number(right.id === currentTabId) - Number(left.id === currentTabId) ||
      Number(right.active) - Number(left.active) ||
      (left.windowId ?? 0) - (right.windowId ?? 0) ||
      (left.index ?? 0) - (right.index ?? 0),
  );
}

export const browserTabsStore = createStore<BrowserTabsState>()(() => ({ tabs: [] }));

let subscribers = 0;
let refreshVersion = 0;

async function refreshBrowserTabs() {
  const version = ++refreshVersion;
  const [tabs, activeTabs] = await Promise.all([
    browser.tabs.query({}),
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  if (subscribers === 0 || version !== refreshVersion) return;
  const currentTabId = activeTabs[0]?.id;
  browserTabsStore.setState({ tabs: sortBrowserTabs(tabs, currentTabId), currentTabId });
}

function scheduleRefresh() {
  void refreshBrowserTabs().catch(console.error);
}

export function connectBrowserTabs(): () => void {
  subscribers += 1;
  if (subscribers === 1) {
    browser.tabs.onCreated.addListener(scheduleRefresh);
    browser.tabs.onUpdated.addListener(scheduleRefresh);
    browser.tabs.onRemoved.addListener(scheduleRefresh);
    browser.tabs.onActivated.addListener(scheduleRefresh);
    scheduleRefresh();
  }

  return () => {
    subscribers -= 1;
    if (subscribers > 0) return;
    subscribers = 0;
    refreshVersion += 1;
    browser.tabs.onCreated.removeListener(scheduleRefresh);
    browser.tabs.onUpdated.removeListener(scheduleRefresh);
    browser.tabs.onRemoved.removeListener(scheduleRefresh);
    browser.tabs.onActivated.removeListener(scheduleRefresh);
  };
}

export function useBrowserTabsStore<T>(selector: (state: BrowserTabsState) => T): T {
  return useStore(browserTabsStore, selector);
}
