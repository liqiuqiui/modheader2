import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { browser } from "wxt/browser";
import type { Locale } from "../config/locales";
import i18n from "../i18n";
import type { ProfileCommand } from "../services/profile/profile-command";
import { reduceProfileCommand } from "../services/profile/reduce-profile-command";
import { type ProfileDocument, type ProfileState } from "../types/profile/profile-document";
import { createProfile } from "../types/profile/profile-factory";
import type { Profile } from "../types/profile/profile-model";
import type { BrowserTab, BrowserTabGroup } from "../types/browser";
import type { EditorMode } from "../pages/editor/types";
import { SIDEBAR_COLLAPSED_KEY } from "../pages/editor/constants";
import { PROFILE_COMMAND_CLIENT_ID } from "../browser/profile/profile-command-client";
import {
  readStoredProfileDocument,
  watchStoredProfileDocument,
} from "../browser/profile/profile-storage";
import {
  initialProfileDataState,
  profileDataFromDocument,
  initialProfileHistoryState,
  pushProfileHistory,
  initialProfileSyncState,
} from "./app-state";
import type { AppStoreState } from "./app-store-contract";
import { documentOf, profileStateOf } from "./app-state";
import {
  createProfileCommandDispatcher,
  createProfileInitializer,
  createAppRuntime,
  createProfileStorageWatcher,
  rememberDeferredDocument,
} from "./app-runtime";
import { createAppActions } from "./app-actions";

const HISTORY_LIMIT = 50;

function sortBrowserTabs(tabs: BrowserTab[], currentTabId?: number) {
  return [...tabs].sort(
    (left, right) =>
      Number(right.id === currentTabId) - Number(left.id === currentTabId) ||
      Number(right.active) - Number(left.active) ||
      (left.windowId ?? 0) - (right.windowId ?? 0) ||
      (left.index ?? 0) - (right.index ?? 0),
  );
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let tabRefreshVersion = 0;
let tabSubscribers = 0;
let tabCleanup: (() => void) | null = null;
// Module scope on purpose: only the first subscriber attaches the tab-group
// listeners, but any subscriber may be the last one to unsubscribe, so the
// disposer has to outlive the closure that created it.
let disconnectTabGroups: (() => void) | null = null;

// `chrome.tabGroups` only exists in Chromium and only once the `tabGroups`
// permission is actually granted (a manifest change alone is not enough: the
// extension has to be reloaded). Querying it must never break tab tracking, so
// failures degrade to an empty list — but they are reported once so the missing
// permission is not silently mistaken for "these groups have no name".
let tabGroupFailureReported = false;

function reportTabGroupFailure(reason: unknown) {
  if (tabGroupFailureReported) return;
  tabGroupFailureReported = true;
  console.warn(
    "[modheader] Tab group titles are unavailable. Reload the extension so the `tabGroups` permission takes effect.",
    reason,
  );
}

type TabGroupsApi = typeof browser.tabGroups;

// WXT resolves `browser` to `globalThis.browser` when present (Chrome 148+ maps
// it to the same objects as `chrome`), but older Chromium builds and non-WXT
// hosts can expose the API under only one of the two namespaces.
function resolveTabGroupsApi(): TabGroupsApi | null {
  try {
    // `browser` itself is undefined outside an extension context (unit tests),
    // and touching a missing namespace throws in some polyfills.
    const fromWxt = browser?.tabGroups as TabGroupsApi | undefined;
    if (fromWxt?.query) return fromWxt;
    const host = globalThis as { chrome?: { tabGroups?: TabGroupsApi } };
    return host.chrome?.tabGroups?.query ? host.chrome.tabGroups : null;
  } catch {
    return null;
  }
}

async function queryTabGroups(): Promise<{
  tabGroups: BrowserTabGroup[];
  available: boolean;
}> {
  const tabGroups = resolveTabGroupsApi();
  if (!tabGroups) {
    reportTabGroupFailure("neither browser.tabGroups nor chrome.tabGroups is available");
    return { tabGroups: [], available: false };
  }
  try {
    return { tabGroups: await tabGroups.query({}), available: true };
  } catch (error) {
    reportTabGroupFailure(error);
    return { tabGroups: [], available: false };
  }
}

async function refreshBrowserTabs(set: (state: Partial<AppStoreState>) => void) {
  const version = ++tabRefreshVersion;
  const [tabs, activeTabs] = await Promise.all([
    browser.tabs.query({}),
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  if (tabSubscribers === 0 || version !== tabRefreshVersion) return;
  const currentTabId = activeTabs[0]?.id;
  // Publish the tabs first: a slow or unavailable `tabGroups` API must neither
  // delay nor hide the tab list itself. The version check is repeated before the
  // second write so only the newest refresh can update either slice.
  set({ tabs: sortBrowserTabs(tabs, currentTabId), currentTabId });
  const groups = await queryTabGroups();
  if (tabSubscribers === 0 || version !== tabRefreshVersion) return;
  set({ tabGroups: groups.tabGroups, tabGroupsAvailable: groups.available });
}

// Renaming a group does not fire any `tabs` event, so groups need their own
// listeners to keep the displayed group names in sync.
function connectBrowserTabGroups(refresh: () => void): () => void {
  const events = resolveTabGroupsApi();
  if (!events) return () => {};
  const listeners = [events.onCreated, events.onUpdated, events.onRemoved, events.onMoved];
  listeners.forEach((event) => event?.addListener(refresh));
  return () => listeners.forEach((event) => event?.removeListener(refresh));
}

// Same rule as `disconnectTabGroups`: the refresh handed to `addListener` must be
// the very reference handed to `removeListener`, so it cannot stay in the closure
// of whichever subscriber happened to subscribe first.
let activeTabsRefresh: (() => void) | null = null;

function connectBrowserTabs(set: (state: Partial<AppStoreState>) => void) {
  tabSubscribers += 1;
  if (tabSubscribers === 1) {
    const refresh = () => void refreshBrowserTabs(set).catch(console.error);
    activeTabsRefresh = refresh;
    browser.tabs.onCreated.addListener(refresh);
    browser.tabs.onUpdated.addListener(refresh);
    browser.tabs.onRemoved.addListener(refresh);
    browser.tabs.onActivated.addListener(refresh);
    disconnectTabGroups = connectBrowserTabGroups(refresh);
    refresh();
  }
  return () => {
    tabSubscribers -= 1;
    if (tabSubscribers > 0) return;
    tabSubscribers = 0;
    tabRefreshVersion += 1;
    const refresh = activeTabsRefresh;
    activeTabsRefresh = null;
    if (refresh) {
      browser.tabs.onCreated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(refresh);
      browser.tabs.onRemoved.removeListener(refresh);
      browser.tabs.onActivated.removeListener(refresh);
    }
    disconnectTabGroups?.();
    disconnectTabGroups = null;
  };
}

function createLocalizedProfile(number: number, locale: Locale): Profile {
  const title = i18n.getFixedT(locale)("profile.defaultName", { number });
  return createProfile({ title });
}

export const appStore = createStore<AppStoreState>()((set, get) => {
  const runtime = createAppRuntime();
  const applyDocument = (
    document: ProfileDocument,
    options: { clearHistory: boolean; error?: string | null },
  ) => {
    runtime.authoritativeDocument = document;
    runtime.lastAuthoritativeRevision = Math.max(
      runtime.lastAuthoritativeRevision,
      document.revision,
    );
    set((state) => ({
      ...profileDataFromDocument(document),
      status: "ready",
      error: options.error ?? null,
      past: options.clearHistory ? [] : state.past,
      future: options.clearHistory ? [] : state.future,
    }));
  };

  const synchronizeAfterCommands = async () => {
    if (runtime.storageResetPending) return;
    let document = runtime.deferredDocument;
    runtime.deferredDocument = null;
    if (!document) {
      document = await readStoredProfileDocument();
    }
    if (!document) return;
    if (runtime.pendingCommands > 0) {
      rememberDeferredDocument(runtime, document);
      return;
    }

    const failureMessage = runtime.commandFailed ? get().error : null;
    applyDocument(document, {
      clearHistory:
        runtime.sawExternalChange ||
        runtime.commandFailed ||
        document.sourceId !== PROFILE_COMMAND_CLIENT_ID,
      error: failureMessage,
    });
    runtime.sawExternalChange = false;
    runtime.commandFailed = false;
  };

  const dispatchCommand = createProfileCommandDispatcher({
    runtime,
    set,
    applyDocument,
    synchronizeAfterCommands,
  });

  const commitCommand = async (
    command: ProfileCommand,
    options: { recordHistory?: boolean; past?: ProfileState[]; future?: ProfileState[] } = {},
  ): Promise<boolean> => {
    const current = get();
    const currentDocument = documentOf(current);
    const result = reduceProfileCommand(currentDocument, command, PROFILE_COMMAND_CLIENT_ID);
    if (result.status === "revision-conflict") {
      set({
        error: `Profile revision conflict: expected ${result.expected}, received ${result.actual}`,
      });
      return false;
    }
    if (result.status === "noop") return true;

    const next = result.document;
    const recordHistory = options.recordHistory ?? true;
    const history = recordHistory
      ? pushProfileHistory(
          profileStateOf(current),
          { past: current.past, future: current.future },
          HISTORY_LIMIT,
        )
      : { past: current.past, future: current.future };
    set({
      ...profileDataFromDocument(next),
      error: null,
      past: options.past ?? history.past,
      future: options.future ?? history.future,
    });
    return dispatchCommand(command);
  };

  const requestInitialization = createProfileInitializer({
    runtime,
    set,
    applyDocument,
    createProfile: (locale) => createLocalizedProfile(1, locale),
  });

  const handleStoredProfileDocument = createProfileStorageWatcher({
    runtime,
    applyDocument,
    requestInitialization,
  });

  const operationActions = createAppActions({
    runtime,
    get,
    commitCommand,
    createLocalizedProfile,
  });

  return {
    ...initialProfileDataState,
    sourceId: PROFILE_COMMAND_CLIENT_ID,
    ...initialProfileHistoryState,
    ...initialProfileSyncState,
    mode: "options",
    collapsed: false,
    searchQuery: "",
    notice: "",
    focusRequest: null,
    tabs: [],
    tabGroups: [],
    // Probed rather than hard-coded `true`: a stale `true` would suppress the
    // "permission missing" hint on the very first render.
    tabGroupsAvailable: resolveTabGroupsApi() !== null,
    currentTabId: undefined,

    initializeEditor: (mode: EditorMode) => {
      if (noticeTimer) {
        clearTimeout(noticeTimer);
        noticeTimer = null;
      }
      tabCleanup?.();
      tabCleanup = null;
      set({
        mode,
        collapsed:
          mode === "popup" || window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
        searchQuery: "",
        notice: "",
        focusRequest: null,
      });
      const disconnectTabs = connectBrowserTabs(set);
      tabCleanup = disconnectTabs;
      return () => {
        if (tabCleanup !== disconnectTabs) return;
        tabCleanup = null;
        disconnectTabs();
      };
    },
    setCollapsed: (collapsed) => {
      set({ collapsed });
      if (get().mode === "options") {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
      }
    },
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    showNotice: (notice) => {
      if (noticeTimer) clearTimeout(noticeTimer);
      set({ notice });
      noticeTimer = setTimeout(() => {
        set({ notice: "" });
        noticeTimer = null;
      }, 2200);
    },
    requestFocus: (kind, id) => set({ focusRequest: { kind, id } }),
    clearFocusRequest: () => set({ focusRequest: null }),

    initialize: async (locale) => {
      runtime.currentLocale = locale;
      if (!runtime.stopWatchingStorage) {
        runtime.stopWatchingStorage = watchStoredProfileDocument(handleStoredProfileDocument);
      }
      if (get().status === "ready") return;

      // Reading is a purely local operation: whatever is persisted has already
      // been validated and committed by the background. Rendering straight from
      // storage avoids an IPC round-trip (and possibly waking up a suspended
      // service worker) just to fetch it, which is what made the popup show a
      // loading state on every open.
      let stored: ProfileDocument | null = null;
      try {
        stored = await readStoredProfileDocument();
      } catch {
        stored = null;
      }
      if (stored && stored.state.profiles.length > 0) {
        applyDocument(stored, { clearHistory: true });
        return;
      }

      // Nothing usable persisted yet (first install). Creating the default
      // profile is a write, so it still goes through the background to keep
      // document mutations serialized across popups / options / windows.
      await requestInitialization(locale);
    },

    ...operationActions,
  };
});

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  return useStore(appStore, selector);
}
