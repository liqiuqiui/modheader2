import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHeaderRule, createProfile, createRedirectRule } from "../../domain/profile-factory";
import { createProfileFilter } from "../../domain/profile-filter";
import { ProfileActionBadgeController } from "../profile-action-badge";
import { compileProfileDnrRules } from "../profile-dnr";
import type { ProfileRequestDetails } from "../profile-request-match";

const browserMock = vi.hoisted(() => ({
  action: {
    getBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setBadgeText: vi.fn(),
    setBadgeTextColor: vi.fn(),
  },
  state: {
    globalBadgeText: "",
    session: {} as Record<string, unknown>,
    tabBadgeTexts: new Map<number, string>(),
    tabs: [{ id: 7 }, { id: 8 }],
  },
  storageSession: {
    get: vi.fn(),
    set: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
  },
}));

vi.mock("wxt/browser", () => ({
  browser: {
    action: browserMock.action,
    storage: { session: browserMock.storageSession },
    tabs: browserMock.tabs,
  },
}));

function matchingProfile() {
  const filter = {
    ...createProfileFilter({ id: "include-api", kind: "urlPattern" }),
    value: "*://api.example.com/*",
  };
  const profile = createProfile({ title: "Test", id: "profile-1", backgroundColor: "#0f766e" });
  return {
    ...profile,
    rules: {
      ...profile.rules,
      requestHeaders: [createHeaderRule({ id: "header-1", name: "authorization", value: "token" })],
    },
    filters: [filter],
  };
}

function withHeadersEnabled(profile: ReturnType<typeof matchingProfile>, enabled: boolean) {
  return {
    ...profile,
    rules: {
      ...profile.rules,
      requestHeaders: profile.rules.requestHeaders.map((rule) => ({ ...rule, enabled })),
    },
  };
}

function request(overrides: Partial<ProfileRequestDetails> = {}): ProfileRequestDetails {
  return {
    initiator: "https://app.example.com",
    method: "GET",
    requestId: "request-1",
    tabId: 7,
    type: "xmlhttprequest",
    url: "https://api.example.com/data",
    ...overrides,
  };
}

describe("Profile action badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browserMock.state.globalBadgeText = "";
    browserMock.state.session = {};
    browserMock.state.tabBadgeTexts.clear();
    browserMock.state.tabs = [{ id: 7 }, { id: 8 }];

    browserMock.action.setBadgeText.mockImplementation(
      async ({ tabId, text }: { tabId?: number; text: string }) => {
        if (typeof tabId === "number") browserMock.state.tabBadgeTexts.set(tabId, text);
        else browserMock.state.globalBadgeText = text;
      },
    );
    browserMock.action.getBadgeText.mockImplementation(async ({ tabId }: { tabId?: number }) =>
      typeof tabId === "number"
        ? (browserMock.state.tabBadgeTexts.get(tabId) ?? browserMock.state.globalBadgeText)
        : browserMock.state.globalBadgeText,
    );
    browserMock.action.setBadgeBackgroundColor.mockResolvedValue(undefined);
    browserMock.action.setBadgeTextColor.mockResolvedValue(undefined);
    browserMock.tabs.query.mockImplementation(async () => browserMock.state.tabs);
    browserMock.storageSession.get.mockImplementation(async (key: string) => ({
      [key]: browserMock.state.session[key],
    }));
    browserMock.storageSession.set.mockImplementation(async (values: Record<string, unknown>) => {
      Object.assign(browserMock.state.session, values);
    });
  });

  it("shows the configured count only on a tab whose request matches", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);

    expect(browserMock.state.globalBadgeText).toBe("");
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
    expect(browserMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#0f766e",
    });
    expect(browserMock.action.setBadgeTextColor).toHaveBeenCalledWith({ color: "white" });

    await controller.observeRequest(request({ url: "https://other.example/data" }));
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");

    await controller.observeRequest(request());
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
    expect(browserMock.state.tabBadgeTexts.get(8)).toBe("");
    expect(browserMock.state.globalBadgeText).toBe("1");
  });

  it("shows the badge only while a matching tab is active", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    await controller.observeTabActivated(8);
    expect(browserMock.state.globalBadgeText).toBe("");

    await controller.observeTabActivated(7);
    expect(browserMock.state.globalBadgeText).toBe("1");
  });

  it("replays requests that arrive while the service worker is restoring state", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    const syncing = controller.sync(profile, compileProfileDnrRules(profile).rules);

    const observing = controller.observeRequest(request());
    await Promise.all([syncing, observing]);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
  });

  it("clears a previous hit when a new page does not match", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    await controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "navigation-2",
        type: "main_frame",
        url: "https://app.example.com/",
      }),
    );

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("keeps a hit visible across redirects in the same top-level request", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);

    await controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "redirect-chain",
        type: "main_frame",
        url: "https://api.example.com/redirect",
      }),
    );
    await controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "redirect-chain",
        type: "main_frame",
        url: "https://app.example.com/target",
      }),
    );

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
  });

  it("restores a matched badge after navigation resets the tab-specific action state", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    browserMock.state.tabBadgeTexts.set(7, "");
    await controller.observeTabComplete(7);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
  });

  it("does not restore a stale badge when the completed page did not match", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());
    await controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "navigation-2",
        type: "main_frame",
        url: "https://app.example.com/",
      }),
    );

    browserMock.state.tabBadgeTexts.set(7, "1");
    await controller.observeTabComplete(7);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("replays a tab completion that arrives while state is being restored", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    const syncing = controller.sync(profile, compileProfileDnrRules(profile).rules);

    const observing = controller.observeRequest(request());
    const completing = controller.observeTabComplete(7);
    await Promise.all([syncing, observing, completing]);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
  });

  it("clears a hit when the tab switches to a non-HTTP page", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    await controller.observeTabUrl(7, "chrome://extensions/");

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("clears tab badges when the active profile runtime changes", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    await controller.sync({ ...profile, paused: true }, []);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("does not keep a stale badge visible when DNR rules are unavailable", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    // The background uses an empty rule set after a DNR apply failure. The
    // configured profile still has enabled rows, but no rules are active.
    await controller.sync(profile, []);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
    expect(browserMock.state.globalBadgeText).toBe("");
  });

  it("restores session state only during the initial controller sync", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const controller = new ProfileActionBadgeController();

    await controller.sync(profile, rules);
    const initialReads = browserMock.storageSession.get.mock.calls.length;

    await controller.sync(profile, rules);

    expect(browserMock.storageSession.get).toHaveBeenCalledTimes(initialReads);
  });

  it("restores a previous hit when a header is disabled and then enabled again", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, rules);
    await controller.observeRequest(request());

    const disabledProfile = withHeadersEnabled(profile, false);
    await controller.sync(disabledProfile, compileProfileDnrRules(disabledProfile).rules);
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
    expect(browserMock.state.globalBadgeText).toBe("");

    await controller.sync(profile, rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
    expect(browserMock.state.globalBadgeText).toBe("1");
  });

  it("does not retain a hit when the filter scope changes", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    const filter = profile.filters[0]!;
    const changedScopeProfile = {
      ...profile,
      filters: [{ ...filter, value: "*://other.example.com/*" }],
    };
    await controller.sync(changedScopeProfile, compileProfileDnrRules(changedScopeProfile).rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
    expect(browserMock.state.globalBadgeText).toBe("");
  });

  it("reconciles hits when a redirect rule is disabled", async () => {
    const baseProfile = matchingProfile();
    const profile = {
      ...baseProfile,
      filters: [],
      rules: {
        ...baseProfile.rules,
        requestHeaders: [],
        redirects: [
          createRedirectRule({
            id: "redirect-api",
            name: "^https://api\\.example\\.com/.*$",
            value: "https://new.example.com/",
          }),
          createRedirectRule({
            id: "redirect-other",
            name: "^https://other\\.example\\.com/.*$",
            value: "https://other-new.example.com/",
          }),
        ],
      },
    };
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("2");

    const disabledRedirectProfile = {
      ...profile,
      rules: {
        ...profile.rules,
        redirects: profile.rules.redirects.map((redirect) =>
          redirect.id === "redirect-api" ? { ...redirect, enabled: false } : redirect,
        ),
      },
    };
    await controller.sync(
      disabledRedirectProfile,
      compileProfileDnrRules(disabledRedirectProfile).rules,
    );

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
    expect(browserMock.state.globalBadgeText).toBe("");
  });

  it("re-evaluates a recorded hit when a tab filter targets the current tab", async () => {
    const profile = matchingProfile();
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, compileProfileDnrRules(profile).rules);
    await controller.observeRequest(request());

    const tabFilter = createProfileFilter({ id: "current-tab", kind: "tab", currentTabId: 7 });
    const filteredProfile = {
      ...profile,
      filters: [...profile.filters, tabFilter],
    };
    await controller.sync(filteredProfile, compileProfileDnrRules(filteredProfile).rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
    expect(browserMock.state.globalBadgeText).toBe("1");
  });

  it("restores per-tab hits after a service worker restart", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const firstController = new ProfileActionBadgeController();
    await firstController.sync(profile, rules);
    await firstController.observeRequest(request());

    browserMock.state.tabBadgeTexts.set(7, "");
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(profile, rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
    expect(browserMock.state.tabBadgeTexts.get(8)).toBe("");
  });

  it("keeps a previous hit through a worker restart while a header is disabled", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const firstController = new ProfileActionBadgeController();
    await firstController.sync(profile, rules);
    await firstController.observeRequest(request());

    const disabledProfile = withHeadersEnabled(profile, false);
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(disabledProfile, compileProfileDnrRules(disabledProfile).rules);
    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");

    await restartedController.sync(profile, rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
    expect(browserMock.state.globalBadgeText).toBe("1");
  });

  it("keeps a redirect-chain hit after a service worker restart", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const firstController = new ProfileActionBadgeController();
    await firstController.sync(profile, rules);
    await firstController.observeRequest(
      request({
        initiator: undefined,
        requestId: "redirect-chain",
        type: "main_frame",
        url: "https://api.example.com/redirect",
      }),
    );

    browserMock.state.tabBadgeTexts.set(7, "");
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(profile, rules);
    await restartedController.observeRequest(
      request({
        initiator: undefined,
        requestId: "redirect-chain",
        type: "main_frame",
        url: "https://app.example.com/target",
      }),
    );

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("1");
  });

  it("does not restore a removed tab from session state", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const firstController = new ProfileActionBadgeController();
    await firstController.sync(profile, rules);
    await firstController.observeRequest(request());
    await firstController.forgetTab(7);

    browserMock.state.tabBadgeTexts.set(7, "");
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(profile, rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("serializes session writes so a stale hit cannot overwrite a later clear", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, rules);

    let releaseFirstWrite: () => void = () => undefined;
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let writeCount = 0;
    browserMock.storageSession.set.mockClear();
    browserMock.storageSession.set.mockImplementation(async (values: Record<string, unknown>) => {
      writeCount += 1;
      if (writeCount === 1) await firstWriteBlocked;
      Object.assign(browserMock.state.session, values);
    });

    const matching = controller.observeRequest(request());
    await vi.waitFor(() => expect(browserMock.storageSession.set).toHaveBeenCalledTimes(1));
    const clearing = controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "navigation-2",
        type: "main_frame",
        url: "https://app.example.com/",
      }),
    );

    expect(browserMock.storageSession.set).toHaveBeenCalledTimes(1);
    releaseFirstWrite();
    await Promise.all([matching, clearing]);
    expect(browserMock.storageSession.set).toHaveBeenCalledTimes(2);

    browserMock.state.tabBadgeTexts.set(7, "");
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(profile, rules);

    expect(browserMock.state.tabBadgeTexts.get(7)).toBe("");
  });

  it("coalesces queued session writes to the latest badge state", async () => {
    const profile = matchingProfile();
    const rules = compileProfileDnrRules(profile).rules;
    const controller = new ProfileActionBadgeController();
    await controller.sync(profile, rules);

    let releaseFirstWrite: () => void = () => undefined;
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let writeCount = 0;
    browserMock.storageSession.set.mockClear();
    browserMock.storageSession.set.mockImplementation(async (values: Record<string, unknown>) => {
      writeCount += 1;
      if (writeCount === 1) await firstWriteBlocked;
      Object.assign(browserMock.state.session, values);
    });

    const firstMatch = controller.observeRequest(request());
    await vi.waitFor(() => expect(browserMock.storageSession.set).toHaveBeenCalledTimes(1));
    const secondMatch = controller.observeRequest(
      request({ requestId: "tab-8-request", tabId: 8 }),
    );
    const clearFirstTab = controller.observeRequest(
      request({
        initiator: undefined,
        requestId: "navigation-2",
        type: "main_frame",
        url: "https://app.example.com/",
      }),
    );

    releaseFirstWrite();
    await Promise.all([firstMatch, secondMatch, clearFirstTab]);

    expect(browserMock.storageSession.set).toHaveBeenCalledTimes(2);

    browserMock.state.tabBadgeTexts.clear();
    const restartedController = new ProfileActionBadgeController();
    await restartedController.sync(profile, rules);
    expect(browserMock.state.tabBadgeTexts.get(7) ?? "").toBe("");
    expect(browserMock.state.tabBadgeTexts.get(8)).toBe("1");
  });
});
