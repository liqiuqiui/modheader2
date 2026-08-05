import { browser } from "wxt/browser";
import type { Profile } from "../domain/profile-model";
import { countEnabledProfileModifications, type ProfileDnrRule } from "./profile-dnr";
import {
  createProfileRequestMatcher,
  type ProfileRequestDetails,
  type ProfileRequestMatcher,
} from "./profile-request-match";

const RUNTIME_STATE_STORAGE_KEY = "profile-action-badge-runtime-state-v5";
const MAX_PENDING_EVENTS = 500;

type PendingBadgeEvent =
  | { type: "request"; request: ProfileRequestDetails }
  | { type: "tabUrl"; tabId: number; url: string }
  | { type: "tabComplete"; tabId: number }
  | { type: "tabActivated"; tabId: number };

type TabEntry<Value> = [number, Value];

interface BadgeRuntime {
  modificationCount: number;
  requestScopeKey: string;
  matchesRequest: ProfileRequestMatcher;
  ready: boolean;
}

interface StoredBadgeRuntimeState {
  requestScopeKey: string;
  matchedTabIds: number[];
  matchedRequests: [number, ProfileRequestDetails][];
  mainFrameRequestIds: [number, string][];
}

function getRequestScopeKey(profile: Profile | undefined): string {
  if (!profile) return JSON.stringify({ profileId: null, filters: [], redirectPatterns: [] });

  const filters = Object.values(profile.filters.byId)
    .map((filter) => ({
      enabled: filter.enabled,
      kind: filter.kind,
      mode: filter.mode,
      value: filter.value,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const redirectPatterns = profile.urlReplacements
    .map((replacement) => ({ id: replacement.id, name: replacement.name.trim() }))
    .filter((replacement) => replacement.name.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify({ profileId: profile.id, filters, redirectPatterns });
}

function isHttpPageUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isTabId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTabIds(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(isTabId) ? value : null;
}

function readTabEntries<Value>(
  value: unknown,
  isValue: (value: unknown) => value is Value,
): TabEntry<Value>[] | null {
  if (!Array.isArray(value)) return null;
  const entries: TabEntry<Value>[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || !isTabId(entry[0]) || !isValue(entry[1])) {
      return null;
    }
    entries.push([entry[0], entry[1]] as TabEntry<Value>);
  }
  return entries;
}

function isProfileRequestDetails(value: unknown): value is ProfileRequestDetails {
  if (!isRecord(value)) return false;
  return (
    (value.initiator === undefined || typeof value.initiator === "string") &&
    typeof value.method === "string" &&
    typeof value.requestId === "string" &&
    isTabId(value.tabId) &&
    typeof value.type === "string" &&
    typeof value.url === "string"
  );
}

function readTabRequestEntries(value: unknown): [number, ProfileRequestDetails][] | null {
  const entries = readTabEntries(value, isProfileRequestDetails);
  return entries?.every(([tabId, request]) => request.tabId === tabId) ? entries : null;
}

export class ProfileActionBadgeController {
  private activeTabId: number | null = null;
  private initialized = false;
  private matchingTabIds = new Set<number>();
  private requestSamplesByTabId = new Map<number, ProfileRequestDetails>();
  private mainFrameRequestIds = new Map<number, string>();
  private pendingEvents: PendingBadgeEvent[] = [];
  private runtime: BadgeRuntime = {
    modificationCount: 0,
    requestScopeKey: "",
    matchesRequest: () => false,
    ready: false,
  };
  private globalBadgeQueue: Promise<void> = Promise.resolve();
  private runtimeStatePersistenceQueue: Promise<void> = Promise.resolve();
  private tabBadgeQueues = new Map<number, Promise<void>>();

  async sync(profile: Profile | undefined, rules: ProfileDnrRule[]): Promise<void> {
    const modificationCount = countEnabledProfileModifications(profile);
    const nextRequestScopeKey = getRequestScopeKey(profile);
    const previousRequestScopeKey = this.runtime.requestScopeKey;
    const wasDisabled = this.runtime.modificationCount === 0;
    this.runtime = {
      modificationCount,
      requestScopeKey: nextRequestScopeKey,
      matchesRequest: createProfileRequestMatcher(rules),
      ready: false,
    };

    const globalUpdates: Promise<void>[] = [this.queueGlobalBadgeText("")];
    if (profile) {
      globalUpdates.push(
        browser.action.setBadgeBackgroundColor({ color: profile.backgroundColor }),
        browser.action.setBadgeTextColor({ color: profile.textColor }),
      );
    }
    await Promise.all(globalUpdates);

    const storedState = await this.readStoredRuntimeState();
    if (!this.initialized) {
      this.initialized = true;
      if (storedState) {
        await this.restoreRuntimeState(storedState);
        if (storedState.requestScopeKey !== nextRequestScopeKey) await this.reconcileMatchingTabs();
        else await this.renderMatchingTabBadges();
      } else await this.clearAllTabState();
    } else if (
      previousRequestScopeKey !== nextRequestScopeKey ||
      (wasDisabled && modificationCount > 0)
    ) {
      await this.reconcileMatchingTabs();
    } else {
      await this.renderMatchingTabBadges();
    }

    await this.queueRuntimeStatePersistence();
    await this.flushPendingEvents();
    this.runtime.ready = true;
    await this.refreshActiveTabBadge();
  }

  async observeRequest(request: ProfileRequestDetails): Promise<void> {
    if (request.tabId < 0) return;
    if (!this.runtime.ready) {
      this.enqueuePendingEvent({ type: "request", request });
      return;
    }
    await this.applyRequest(request);
  }

  async observeTabUrl(tabId: number, url: string): Promise<void> {
    if (!this.runtime.ready) {
      this.enqueuePendingEvent({ type: "tabUrl", tabId, url });
      return;
    }
    await this.applyTabUrl(tabId, url);
  }

  async observeTabComplete(tabId: number): Promise<void> {
    if (tabId < 0) return;
    if (!this.runtime.ready) {
      this.enqueuePendingEvent({ type: "tabComplete", tabId });
      return;
    }
    await this.applyTabComplete(tabId);
  }

  async observeTabActivated(tabId: number): Promise<void> {
    this.activeTabId = tabId;
    if (!this.runtime.ready) {
      this.enqueuePendingEvent({ type: "tabActivated", tabId });
      return;
    }
    await this.applyActiveTabBadge();
  }

  async forgetTab(tabId: number): Promise<void> {
    const wasActive = this.activeTabId === tabId;
    if (wasActive) this.activeTabId = null;
    const stateChanged = this.clearTabTracking(tabId);
    this.tabBadgeQueues.delete(tabId);
    this.pendingEvents = this.pendingEvents.filter((event) =>
      event.type === "request" ? event.request.tabId !== tabId : event.tabId !== tabId,
    );
    await Promise.all([
      wasActive ? this.queueGlobalBadgeText("") : undefined,
      stateChanged ? this.queueRuntimeStatePersistence() : undefined,
    ]);
  }

  private async applyRequest(request: ProfileRequestDetails): Promise<void> {
    let badgeText: string | undefined;
    let stateChanged = false;
    if (request.type === "main_frame") {
      const startsNewNavigation = this.mainFrameRequestIds.get(request.tabId) !== request.requestId;
      if (startsNewNavigation) {
        this.mainFrameRequestIds.set(request.tabId, request.requestId);
        stateChanged = true;
        stateChanged = this.clearTabMatch(request.tabId) || stateChanged;
        badgeText = "";
      }
    }

    if (
      this.runtime.modificationCount > 0 &&
      !this.matchingTabIds.has(request.tabId) &&
      this.runtime.matchesRequest(request)
    ) {
      this.matchingTabIds.add(request.tabId);
      this.requestSamplesByTabId.set(request.tabId, request);
      stateChanged = true;
      badgeText = this.badgeTextFor(request.tabId);
    }

    await Promise.all([
      badgeText === undefined ? undefined : this.renderTabBadge(request.tabId, badgeText),
      stateChanged ? this.queueRuntimeStatePersistence() : undefined,
    ]);
  }

  private async applyTabUrl(tabId: number, url: string): Promise<void> {
    if (isHttpPageUrl(url)) return;
    const stateChanged = this.clearTabTracking(tabId);
    await Promise.all([
      this.renderTabBadge(tabId, ""),
      stateChanged ? this.queueRuntimeStatePersistence() : undefined,
    ]);
  }

  private async applyTabComplete(tabId: number): Promise<void> {
    await this.renderTabBadge(tabId, this.badgeTextFor(tabId));
  }

  private enqueuePendingEvent(event: PendingBadgeEvent): void {
    this.pendingEvents.push(event);
    if (this.pendingEvents.length > MAX_PENDING_EVENTS) this.pendingEvents.shift();
  }

  private async flushPendingEvents(): Promise<void> {
    while (this.pendingEvents.length > 0) {
      const events = this.pendingEvents.splice(0);
      for (const event of events) {
        if (event.type === "request") await this.applyRequest(event.request);
        else if (event.type === "tabUrl") await this.applyTabUrl(event.tabId, event.url);
        else if (event.type === "tabComplete") await this.applyTabComplete(event.tabId);
        else await this.applyActiveTabBadge();
      }
    }
  }

  private async clearAllTabState(): Promise<void> {
    this.resetTabTracking();
    const tabs = await browser.tabs.query({});
    await Promise.all([
      this.queueGlobalBadgeText(""),
      ...tabs.flatMap((tab) =>
        typeof tab.id === "number" ? [this.queueTabBadgeText(tab.id, "")] : [],
      ),
    ]);
  }

  private async restoreRuntimeState(state: StoredBadgeRuntimeState): Promise<void> {
    this.resetTabTracking();

    const tabs = await browser.tabs.query({});
    const existingTabIds = new Set(
      tabs.flatMap((tab) => (typeof tab.id === "number" ? [tab.id] : [])),
    );
    const eligibleMatchedTabIds = new Set(
      tabs.flatMap((tab) =>
        typeof tab.id === "number" && (typeof tab.url !== "string" || isHttpPageUrl(tab.url))
          ? [tab.id]
          : [],
      ),
    );
    for (const tabId of state.matchedTabIds) {
      if (eligibleMatchedTabIds.has(tabId)) this.matchingTabIds.add(tabId);
    }
    for (const [tabId, request] of state.matchedRequests) {
      if (eligibleMatchedTabIds.has(tabId)) this.requestSamplesByTabId.set(tabId, request);
    }
    for (const [tabId, requestId] of state.mainFrameRequestIds) {
      if (existingTabIds.has(tabId)) this.mainFrameRequestIds.set(tabId, requestId);
    }
  }

  private async reconcileMatchingTabs(): Promise<void> {
    const previousMatchingTabIds = new Set(this.matchingTabIds);
    this.matchingTabIds = new Set(
      [...this.requestSamplesByTabId].flatMap(([tabId, request]) =>
        this.runtime.matchesRequest(request) ? [tabId] : [],
      ),
    );
    const affectedTabIds = new Set([
      ...previousMatchingTabIds,
      ...this.requestSamplesByTabId.keys(),
    ]);
    await Promise.all(
      [...affectedTabIds].map((tabId) => this.renderTabBadge(tabId, this.badgeTextFor(tabId))),
    );
  }

  private badgeTextFor(tabId: number): string {
    return this.matchingTabIds.has(tabId) && this.runtime.modificationCount > 0
      ? String(this.runtime.modificationCount)
      : "";
  }

  private async renderMatchingTabBadges(): Promise<void> {
    await Promise.all(
      [...this.matchingTabIds].map((tabId) => this.renderTabBadge(tabId, this.badgeTextFor(tabId))),
    );
  }

  private clearTabMatch(tabId: number): boolean {
    const removedMatch = this.matchingTabIds.delete(tabId);
    const removedSample = this.requestSamplesByTabId.delete(tabId);
    return removedMatch || removedSample;
  }

  private clearTabTracking(tabId: number): boolean {
    const removedMatch = this.clearTabMatch(tabId);
    const removedNavigation = this.mainFrameRequestIds.delete(tabId);
    return removedMatch || removedNavigation;
  }

  private resetTabTracking(): void {
    this.matchingTabIds.clear();
    this.requestSamplesByTabId.clear();
    this.mainFrameRequestIds.clear();
  }

  private async renderTabBadge(tabId: number, text: string): Promise<void> {
    await Promise.all([
      this.queueTabBadgeText(tabId, text),
      this.activeTabId === tabId ? this.queueGlobalBadgeText(text) : undefined,
    ]);
  }

  private queueTabBadgeText(tabId: number, text: string): Promise<void> {
    const previous = this.tabBadgeQueues.get(tabId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => browser.action.setBadgeText({ tabId, text }));
    this.tabBadgeQueues.set(tabId, next);
    void next.then(
      () => {
        if (this.tabBadgeQueues.get(tabId) === next) this.tabBadgeQueues.delete(tabId);
      },
      () => {
        if (this.tabBadgeQueues.get(tabId) === next) this.tabBadgeQueues.delete(tabId);
      },
    );
    return next;
  }

  private async refreshActiveTabBadge(): Promise<void> {
    const [activeTab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    this.activeTabId = typeof activeTab?.id === "number" ? activeTab.id : null;
    await this.applyActiveTabBadge();
  }

  private async applyActiveTabBadge(): Promise<void> {
    const text = this.activeTabId === null ? "" : this.badgeTextFor(this.activeTabId);
    await this.queueGlobalBadgeText(text);
  }

  private queueGlobalBadgeText(text: string): Promise<void> {
    const next = this.globalBadgeQueue
      .catch(() => undefined)
      .then(() => browser.action.setBadgeText({ text }));
    this.globalBadgeQueue = next;
    return next;
  }

  private async readStoredRuntimeState(): Promise<StoredBadgeRuntimeState | null> {
    try {
      const stored = await browser.storage.session.get(RUNTIME_STATE_STORAGE_KEY);
      const value = stored[RUNTIME_STATE_STORAGE_KEY];
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      const matchedTabIds = readTabIds(record.matchedTabIds);
      const matchedRequests = readTabRequestEntries(record.matchedRequests);
      const mainFrameRequestIds = readTabEntries(
        record.mainFrameRequestIds,
        (entry): entry is string => typeof entry === "string",
      );
      if (
        typeof record.requestScopeKey !== "string" ||
        !matchedTabIds ||
        !matchedRequests ||
        !mainFrameRequestIds
      ) {
        return null;
      }
      return {
        requestScopeKey: record.requestScopeKey,
        matchedTabIds,
        matchedRequests,
        mainFrameRequestIds,
      };
    } catch {
      return null;
    }
  }

  private queueRuntimeStatePersistence(): Promise<void> {
    const value: StoredBadgeRuntimeState = {
      requestScopeKey: this.runtime.requestScopeKey,
      matchedTabIds: [...this.matchingTabIds].sort((left, right) => left - right),
      matchedRequests: [...this.requestSamplesByTabId].sort(([left], [right]) => left - right),
      mainFrameRequestIds: [...this.mainFrameRequestIds].sort(([left], [right]) => left - right),
    };
    const next = this.runtimeStatePersistenceQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          await browser.storage.session.set({ [RUNTIME_STATE_STORAGE_KEY]: value });
        } catch {
          // Session persistence is an optimization; request matching still works without it.
        }
      });
    this.runtimeStatePersistenceQueue = next;
    return next;
  }
}

export const profileActionBadgeController = new ProfileActionBadgeController();
