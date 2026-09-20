import { describe, expect, it } from "vitest";
import type { ProfileDnrRule } from "../profile-dnr";
import { createProfileRequestMatcher, type ProfileRequestDetails } from "../profile-request-match";

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

function modificationRule(
  condition: ProfileDnrRule["condition"],
  overrides: Partial<ProfileDnrRule> = {},
): ProfileDnrRule {
  return {
    id: 10000,
    priority: 1000,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "x-test", operation: "set", value: "1" }],
    },
    condition,
    ...overrides,
  };
}

describe("Profile request matching", () => {
  it("supports DNR URL wildcards, anchors, separators, and case-insensitive matching", () => {
    const matches = createProfileRequestMatcher([
      modificationRule({ urlFilter: "||EXAMPLE.com^" }),
    ]);

    expect(matches(request({ url: "https://sub.example.com/path" }))).toBe(true);
    expect(matches(request({ url: "https://example.company/path" }))).toBe(false);

    const exactApi = createProfileRequestMatcher([
      modificationRule({ urlFilter: "|https://api.example.com/*|" }),
    ]);
    expect(exactApi(request())).toBe(true);
    expect(exactApi(request({ url: "https://prefix.test/https://api.example.com/data" }))).toBe(
      false,
    );
  });

  it("matches request method, resource type, tab, and initiator domain conditions", () => {
    const matches = createProfileRequestMatcher([
      modificationRule({
        initiatorDomains: ["example.com"],
        requestMethods: ["post"],
        resourceTypes: ["xmlhttprequest"],
        tabIds: [7],
      }),
    ]);

    expect(matches(request({ method: "POST", initiator: "https://sub.example.com" }))).toBe(true);
    expect(matches(request({ method: "GET" }))).toBe(false);
    expect(matches(request({ method: "POST", tabId: 8 }))).toBe(false);
    expect(matches(request({ method: "POST", type: "script" }))).toBe(false);
    expect(matches(request({ method: "POST", initiator: "https://example.net" }))).toBe(false);
  });

  it("honors exclusion conditions and higher-priority allow rules", () => {
    const action = modificationRule({ urlFilter: "*://*.example.com/*" });
    const allow: ProfileDnrRule = {
      id: 10001,
      priority: 10000,
      action: { type: "allow" },
      condition: { urlFilter: "*://api.example.com/private/*" },
    };
    const matches = createProfileRequestMatcher([allow, action]);

    expect(matches(request({ url: "https://api.example.com/public/data" }))).toBe(true);
    expect(matches(request({ url: "https://api.example.com/private/data" }))).toBe(false);
  });

  it("supports regex URL filters", () => {
    const matches = createProfileRequestMatcher([
      modificationRule({ regexFilter: String.raw`^https://api\.example\.com/v\d+/` }),
    ]);

    expect(matches(request({ url: "https://api.example.com/v2/items" }))).toBe(true);
    expect(matches(request({ url: "https://api.example.com/items" }))).toBe(false);
  });

  it("distinguishes request target domains from initiator domains", () => {
    const matches = createProfileRequestMatcher([
      modificationRule({
        requestDomains: ["api.example.com"],
        excludedRequestDomains: ["private.example.com"],
      }),
    ]);

    expect(matches(request({ url: "https://api.example.com/data" }))).toBe(true);
    expect(matches(request({ url: "https://other.example.com/data" }))).toBe(false);
    expect(matches(request({ url: "https://private.example.com/data" }))).toBe(false);
  });
});
