import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileDnrRule } from "../profile-dnr";
import { applyDnrRules, MAX_PROFILE_DNR_RULES, PROFILE_DNR_RULE_ID_BASE } from "../profile-dnr";

const dnrMocks = vi.hoisted(() => ({
  isRegexSupported: vi.fn(),
  updateDynamicRules: vi.fn(),
  updateSessionRules: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    declarativeNetRequest: dnrMocks,
  },
}));

const managedRuleIds = Array.from(
  { length: MAX_PROFILE_DNR_RULES },
  (_, index) => PROFILE_DNR_RULE_ID_BASE + index,
);

function redirectRule(): ProfileDnrRule {
  return {
    id: PROFILE_DNR_RULE_ID_BASE,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: "https://new.example/\\1" },
    },
    condition: { regexFilter: "^https://old\\.example/(.*)$" },
  };
}

describe("Profile DNR runtime application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dnrMocks.isRegexSupported.mockResolvedValue({ isSupported: true });
    dnrMocks.updateDynamicRules.mockResolvedValue(undefined);
    dnrMocks.updateSessionRules.mockResolvedValue(undefined);
  });

  it("clears managed rules when a regex is unsupported", async () => {
    dnrMocks.isRegexSupported.mockResolvedValue({
      isSupported: false,
      reason: "syntaxError",
    });

    await expect(applyDnrRules([redirectRule()])).rejects.toThrow("Unsupported profile regex");

    expect(dnrMocks.updateDynamicRules).toHaveBeenCalledOnce();
    expect(dnrMocks.updateSessionRules).toHaveBeenCalledOnce();
    expect(dnrMocks.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: managedRuleIds,
      addRules: [],
    });
    expect(dnrMocks.updateSessionRules).toHaveBeenCalledWith({
      removeRuleIds: managedRuleIds,
      addRules: [],
    });
  });

  it("clears managed rules after the browser rejects an update", async () => {
    dnrMocks.updateSessionRules
      .mockRejectedValueOnce(new Error("invalid rule"))
      .mockResolvedValueOnce(undefined);

    await expect(applyDnrRules([redirectRule()])).rejects.toThrow("invalid rule");

    expect(dnrMocks.updateDynamicRules).toHaveBeenCalledTimes(2);
    expect(dnrMocks.updateSessionRules).toHaveBeenCalledTimes(2);
    expect(dnrMocks.updateDynamicRules).toHaveBeenLastCalledWith({
      removeRuleIds: managedRuleIds,
      addRules: [],
    });
    expect(dnrMocks.updateSessionRules).toHaveBeenLastCalledWith({
      removeRuleIds: managedRuleIds,
      addRules: [],
    });
  });
});
