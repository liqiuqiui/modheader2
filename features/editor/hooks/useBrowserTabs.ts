import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import type { BrowserTab } from "../../../types/browser";

function sortBrowserTabs(tabs: BrowserTab[], currentTabId?: number) {
  return [...tabs].sort(
    (left, right) =>
      Number(right.id === currentTabId) - Number(left.id === currentTabId) ||
      Number(right.active) - Number(left.active) ||
      (left.windowId ?? 0) - (right.windowId ?? 0) ||
      (left.index ?? 0) - (right.index ?? 0),
  );
}

interface BrowserTabsState {
  tabs: BrowserTab[];
  currentTabId?: number;
}

/** 查询当前标签页，并在标签页生命周期/激活状态变化时同步。 */
export function useBrowserTabs(): BrowserTabsState {
  const [state, setState] = useState<BrowserTabsState>({ tabs: [] });

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const [nextTabs, currentTabs] = await Promise.all([
        browser.tabs.query({}),
        browser.tabs.query({ active: true, lastFocusedWindow: true }),
      ]);
      if (alive) {
        const currentTabId = currentTabs[0]?.id;
        setState({ tabs: sortBrowserTabs(nextTabs, currentTabId), currentTabId });
      }
    };

    void refresh();
    browser.tabs.onCreated.addListener(refresh);
    browser.tabs.onUpdated.addListener(refresh);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onActivated.addListener(refresh);

    return () => {
      alive = false;
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(refresh);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
    };
  }, []);

  return state;
}
