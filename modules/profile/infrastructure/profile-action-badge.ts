import { browser } from "wxt/browser";
import type { Profile } from "../domain/profile-model";
import { countEnabledProfileModifications, type ProfileDnrRule } from "./profile-dnr";
import {
  createProfileRequestMatcher,
  type ProfileRequestDetails,
  type ProfileRequestMatcher,
} from "./profile-request-match";

const RUNTIME_KEY_STORAGE_KEY = "profile-action-badge-runtime-key-v1";
const MAX_PENDING_EVENTS = 500;

type PendingBadgeEvent =
  | { type: "request"; request: ProfileRequestDetails }
  | { type: "tabUrl"; tabId: number; url: string };

interface BadgeRuntime {
  count: number;
  key: string;
  matchesRequest: ProfileRequestMatcher;
  ready: boolean;
}

function runtimeKey(profile: Profile | undefined, count: number, rules: ProfileDnrRule[]): string {
  return JSON.stringify({ profileId: profile?.id ?? null, count, rules });
}

function comparableUrl(url: string): string {
  try {
    const value = new URL(url);
    value.hash = "";
    return value.href;
  } catch {
    return url.replace(/#.*$/, "");
  }
}

function isHttpPageUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export class ProfileActionBadgeController {
  private initialized = false;
  private matchedTabIds = new Set<number>();
  private mainFrameRequestIds = new Map<number, string>();
  private mainFrameUrls = new Map<number, string>();
  private pendingEvents: PendingBadgeEvent[] = [];
  private runtime: BadgeRuntime = {
    count: 0,
    key: "",
    matchesRequest: () => false,
    ready: false,
  };
  private tabBadgeQueues = new Map<number, Promise<void>>();

  async sync(profile: Profile | undefined, rules: ProfileDnrRule[]): Promise<void> {
    const count = countEnabledProfileModifications(profile);
    const key = runtimeKey(profile, count, rules);
    const previousKey = this.runtime.key;
    this.runtime = {
      count,
      key,
      matchesRequest: createProfileRequestMatcher(rules),
      ready: false,
    };

    const globalUpdates: Promise<void>[] = [browser.action.setBadgeText({ text: "" })];
    if (profile) {
      globalUpdates.push(
        browser.action.setBadgeBackgroundColor({ color: profile.backgroundColor }),
        browser.action.setBadgeTextColor({ color: profile.textColor }),
      );
    }
    await Promise.all(globalUpdates);

    const storedKey = await this.readStoredRuntimeKey();
    if (!this.initialized) {
      this.initialized = true;
      if (storedKey === key) await this.restoreMatchedTabs();
      else await this.clearAllTabBadges();
    } else if (previousKey !== key) {
      await this.clearAllTabBadges();
    } else {
      await Promise.all(
        [...this.matchedTabIds].map((tabId) =>
          this.queueTabBadgeText(tabId, count > 0 ? String(count) : ""),
        ),
      );
    }

    await this.writeStoredRuntimeKey(key);
    await this.flushPendingEvents();
    this.runtime.ready = true;
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

  forgetTab(tabId: number): void {
    this.matchedTabIds.delete(tabId);
    this.mainFrameRequestIds.delete(tabId);
    this.mainFrameUrls.delete(tabId);
    this.tabBadgeQueues.delete(tabId);
    this.pendingEvents = this.pendingEvents.filter((event) =>
      event.type === "request" ? event.request.tabId !== tabId : event.tabId !== tabId,
    );
  }

  private async applyRequest(request: ProfileRequestDetails): Promise<void> {
    let badgeUpdate: Promise<void> | undefined;
    if (request.type === "main_frame") {
      const startsNewNavigation = this.mainFrameRequestIds.get(request.tabId) !== request.requestId;
      this.mainFrameRequestIds.set(request.tabId, request.requestId);
      this.mainFrameUrls.set(request.tabId, comparableUrl(request.url));
      if (startsNewNavigation) {
        this.matchedTabIds.delete(request.tabId);
        badgeUpdate = this.queueTabBadgeText(request.tabId, "");
      }
    }

    if (
      this.runtime.count > 0 &&
      !this.matchedTabIds.has(request.tabId) &&
      this.runtime.matchesRequest(request)
    ) {
      this.matchedTabIds.add(request.tabId);
      badgeUpdate = this.queueTabBadgeText(request.tabId, String(this.runtime.count));
    }

    await badgeUpdate;
  }

  private async applyTabUrl(tabId: number, url: string): Promise<void> {
    if (isHttpPageUrl(url)) return;
    const normalizedUrl = comparableUrl(url);
    if (this.mainFrameUrls.get(tabId) === normalizedUrl) return;
    this.mainFrameRequestIds.delete(tabId);
    this.mainFrameUrls.set(tabId, normalizedUrl);
    await this.clearTabBadge(tabId);
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
        else await this.applyTabUrl(event.tabId, event.url);
      }
    }
  }

  private async clearTabBadge(tabId: number): Promise<void> {
    this.matchedTabIds.delete(tabId);
    await this.queueTabBadgeText(tabId, "");
  }

  private async clearAllTabBadges(): Promise<void> {
    this.matchedTabIds.clear();
    const tabs = await browser.tabs.query({});
    await Promise.all(
      tabs.flatMap((tab) =>
        typeof tab.id === "number" ? [this.queueTabBadgeText(tab.id, "")] : [],
      ),
    );
  }

  private async restoreMatchedTabs(): Promise<void> {
    this.matchedTabIds.clear();
    if (this.runtime.count <= 0) {
      await this.clearAllTabBadges();
      return;
    }

    const tabs = await browser.tabs.query({});
    await Promise.all(
      tabs.flatMap((tab) => {
        if (typeof tab.id !== "number") return [];
        const tabId = tab.id;
        return [
          browser.action.getBadgeText({ tabId }).then((text) => {
            if (!text) return;
            this.matchedTabIds.add(tabId);
            return this.queueTabBadgeText(tabId, String(this.runtime.count));
          }),
        ];
      }),
    );
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

  private async readStoredRuntimeKey(): Promise<string | null> {
    try {
      const stored = await browser.storage.session.get(RUNTIME_KEY_STORAGE_KEY);
      const value = stored[RUNTIME_KEY_STORAGE_KEY];
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  private async writeStoredRuntimeKey(key: string): Promise<void> {
    try {
      await browser.storage.session.set({ [RUNTIME_KEY_STORAGE_KEY]: key });
    } catch {
      // Session persistence is an optimization; request matching still works without it.
    }
  }
}

export const profileActionBadgeController = new ProfileActionBadgeController();
