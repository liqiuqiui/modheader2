import { describe, expect, it } from "vitest";
import {
  createCookieRule,
  createCspRule,
  createHeaderRule,
  createProfile,
  createRedirectRule,
} from "../../../types/profile/profile-factory";
import { createProfileFilter } from "../../../types/profile/profile-filter";
import type { Profile, ProfileFilter } from "../../../types/profile/profile-model";
import {
  compileProfileDnrRules,
  countEnabledProfileModifications,
  MAX_PROFILE_DNR_RULES,
  nextProfileTimeFilterExpiration,
  PROFILE_DNR_RULE_ID_BASE,
  profileToDnrRules,
  type ProfileDnrCompileOptions,
} from "../profile-dnr";

function profileWithFilters(filters: ProfileFilter[]): Profile {
  const profile = createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" });
  return {
    ...profile,
    rules: {
      ...profile.rules,
      requestHeaders: [createHeaderRule({ id: "header-1", name: "x-test", value: "1" })],
    },
    filters,
  };
}

function withRules(profile: Profile, rules: Partial<Profile["rules"]>): Profile {
  return { ...profile, rules: { ...profile.rules, ...rules } };
}

function modifyHeaderRule(profile: Profile, options?: ProfileDnrCompileOptions) {
  return compileProfileDnrRules(profile, options).rules.find(
    (rule) => rule.action.type === "modifyHeaders",
  );
}

const invalidEnabledIncludes: Array<{
  label: string;
  filter: ProfileFilter;
  diagnostic: string;
}> = [
  {
    label: "invalid URL regular expression",
    filter: {
      ...createProfileFilter({ id: "invalid-regex", kind: "urlRegex" }),
      value: "(",
    },
    diagnostic: "An enabled URL regex filter is invalid",
  },
  {
    label: "invalid initiator",
    filter: {
      ...createProfileFilter({ id: "invalid-initiator", kind: "initiator" }),
      value: "https://example.com",
    },
    diagnostic: "An enabled initiator filter has an invalid domain",
  },
  {
    label: "invalid request domain",
    filter: {
      ...createProfileFilter({ id: "invalid-request-domain", kind: "requestDomain" }),
      value: "https://example.com",
    },
    diagnostic: "An enabled request domain filter has an invalid domain",
  },
];

describe("Profile DNR compilation", () => {
  it("counts effective enabled modification rows instead of compiled DNR rules", () => {
    const profile = withRules(
      profileWithFilters([
        {
          ...createProfileFilter({ id: "include-one", kind: "urlPattern" }),
          value: "*://one.example/*",
        },
        {
          ...createProfileFilter({ id: "include-two", kind: "urlPattern" }),
          value: "*://two.example/*",
        },
      ]),
      {
        requestHeaders: [
          createHeaderRule({ id: "request-active", name: "authorization", value: "token" }),
          createHeaderRule({ id: "request-draft", name: "", value: "draft" }),
          createHeaderRule({
            id: "request-empty",
            name: "x-empty",
            value: "",
            sendEmptyHeader: true,
          }),
        ],
        responseHeaders: [
          createHeaderRule({ id: "response-active", name: "x-response", value: "1" }),
        ],
        csp: [
          createCspRule({ id: "csp-active", directive: "default-src", value: "'self'" }),
          createCspRule({ id: "csp-draft", directive: "", value: "'self'" }),
        ],
        cookies: [
          createCookieRule({ id: "cookie-active", name: "session", value: "" }),
          createCookieRule({ id: "cookie-disabled", name: "ignored", enabled: false }),
        ],
        redirects: [
          createRedirectRule({
            id: "redirect-active",
            name: "^https://old\\.example/(.*)$",
            value: "https://new.example/$1",
          }),
          createRedirectRule({ id: "redirect-draft", name: "^https://draft\\.example/" }),
        ],
      },
    );

    expect(countEnabledProfileModifications(profile)).toBe(6);
    expect(compileProfileDnrRules(withRules(profile, { redirects: [] })).rules).toHaveLength(10);
  });

  it("counts no modifications while the profile is disabled or paused", () => {
    const profile = profileWithFilters([]);

    expect(countEnabledProfileModifications(profile)).toBe(1);
    expect(countEnabledProfileModifications({ ...profile, enabled: false })).toBe(0);
    expect(countEnabledProfileModifications({ ...profile, paused: true })).toBe(0);
    expect(countEnabledProfileModifications()).toBe(0);
  });

  it("returns no rules for disabled or paused profiles", () => {
    const profile = profileWithFilters([]);

    expect(profileToDnrRules({ ...profile, enabled: false })).toEqual([]);
    expect(profileToDnrRules({ ...profile, paused: true })).toEqual([]);
  });

  it("does not compile a profile after every enabled time filter has expired", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "expired", kind: "time" }), value: Date.now() - 1 },
    ]);
    expect(compileProfileDnrRules(profile).rules).toEqual([]);
  });

  it("keeps a profile active while all enabled time filters are in the future", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "future", kind: "time" }), value: Date.now() + 60_000 },
    ]);
    expect(compileProfileDnrRules(profile).rules.length).toBeGreaterThan(0);
  });

  it("ignores disabled expired time filters and schedules the nearest future expiration", () => {
    const now = 1_700_000_000_000;
    const profile = profileWithFilters([
      {
        ...createProfileFilter({ id: "disabled-expired", kind: "time" }),
        enabled: false,
        value: now - 1,
      },
      { ...createProfileFilter({ id: "later", kind: "time" }), value: now + 120_000 },
      { ...createProfileFilter({ id: "sooner", kind: "time" }), value: now + 60_000 },
    ]);

    expect(nextProfileTimeFilterExpiration(profile, now)).toBe(now + 60_000);
  });

  it("leaves resource and method conditions open when no such filters exist", () => {
    const rule = modifyHeaderRule(profileWithFilters([]));

    expect(rule?.condition.resourceTypes).toBeUndefined();
    expect(rule?.condition.excludedResourceTypes).toBeUndefined();
    expect(rule?.condition.requestMethods).toBeUndefined();
    expect(rule?.condition.excludedRequestMethods).toBeUndefined();
  });

  it("uses exclusion conditions without narrowing requests to the UI option list", () => {
    const filters: ProfileFilter[] = [
      {
        ...createProfileFilter({ id: "exclude-image", kind: "resourceType", mode: "exclude" }),
        value: "image",
      },
      {
        ...createProfileFilter({ id: "exclude-post", kind: "method", mode: "exclude" }),
        value: "post",
      },
    ];
    const rule = modifyHeaderRule(profileWithFilters(filters));

    expect(rule?.condition.resourceTypes).toBeUndefined();
    expect(rule?.condition.excludedResourceTypes).toEqual(["image"]);
    expect(rule?.condition.requestMethods).toBeUndefined();
    expect(rule?.condition.excludedRequestMethods).toEqual(["post"]);
  });

  it("compiles request-domain filters separately from initiator filters", () => {
    const rule = modifyHeaderRule(
      profileWithFilters([
        {
          ...createProfileFilter({ id: "request-domain", kind: "requestDomain" }),
          value: "api.example.com",
        },
        {
          ...createProfileFilter({
            id: "exclude-request-domain",
            kind: "requestDomain",
            mode: "exclude",
          }),
          value: "private.example.com",
        },
        {
          ...createProfileFilter({ id: "initiator", kind: "initiator" }),
          value: "app.example.com",
        },
      ]),
    );
    expect(rule?.condition.requestDomains).toEqual(["api.example.com"]);
    expect(rule?.condition.excludedRequestDomains).toEqual(["private.example.com"]);
    expect(rule?.condition.initiatorDomains).toEqual(["app.example.com"]);
  });

  it("trims and lowercases request-domain filters", () => {
    const rule = modifyHeaderRule(
      profileWithFilters([
        {
          ...createProfileFilter({ id: "mixed-case", kind: "requestDomain" }),
          value: "  API.Example.COM  ",
        },
        {
          ...createProfileFilter({
            id: "exclude-mixed-case",
            kind: "requestDomain",
            mode: "exclude",
          }),
          value: "PRIVATE.Example.com",
        },
      ]),
    );
    expect(rule?.condition.requestDomains).toEqual(["api.example.com"]);
    expect(rule?.condition.excludedRequestDomains).toEqual(["private.example.com"]);
  });

  it("maps tab-group and window filters to matching tab IDs", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "group", kind: "tabGroup" }), value: 7 },
      { ...createProfileFilter({ id: "window", kind: "window", mode: "exclude" }), value: 3 },
    ]);
    const rule = modifyHeaderRule(profile, {
      tabs: [
        { id: 11, groupId: 7, windowId: 1 },
        { id: 12, groupId: 8, windowId: 3 },
        { id: 13, groupId: 7, windowId: 3 },
      ],
    });
    expect(rule?.condition.tabIds).toEqual([11, 13]);
    expect(rule?.condition.excludedTabIds).toEqual([12, 13]);
  });

  it("fails closed when a tab-group filter has no valid value", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "group", kind: "tabGroup" }), value: -1 },
    ]);
    expect(
      compileProfileDnrRules(profile, { tabs: [{ id: 11, groupId: 7, windowId: 1 }] }),
    ).toEqual({
      rules: [],
      diagnostics: ["An enabled tab group or window filter has no valid value"],
    });
  });

  it("fails closed when tab-group filters have no tab context", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "group", kind: "tabGroup" }), value: 7 },
    ]);
    expect(compileProfileDnrRules(profile)).toEqual({
      rules: [],
      diagnostics: ["Tab group and window filters require tab context"],
    });
  });

  it("fails closed when tab-group filters match no open tabs", () => {
    const profile = profileWithFilters([
      { ...createProfileFilter({ id: "group", kind: "tabGroup" }), value: 7 },
    ]);
    expect(
      compileProfileDnrRules(profile, { tabs: [{ id: 11, groupId: 8, windowId: 1 }] }),
    ).toEqual({
      rules: [],
      diagnostics: ["Tab group or window filters match no open tabs"],
    });
  });

  it("subtracts resource and method excludes from include candidates", () => {
    const filters: ProfileFilter[] = [
      { ...createProfileFilter({ id: "resource-image", kind: "resourceType" }), value: "image" },
      { ...createProfileFilter({ id: "resource-script", kind: "resourceType" }), value: "script" },
      {
        ...createProfileFilter({
          id: "exclude-script",
          kind: "resourceType",
          mode: "exclude",
        }),
        value: "script",
      },
      { ...createProfileFilter({ id: "method-get", kind: "method" }), value: "get" },
      { ...createProfileFilter({ id: "method-post", kind: "method" }), value: "post" },
      {
        ...createProfileFilter({ id: "exclude-post", kind: "method", mode: "exclude" }),
        value: "post",
      },
    ];
    const rule = modifyHeaderRule(profileWithFilters(filters));

    expect(rule?.condition.resourceTypes).toEqual(["image"]);
    expect(rule?.condition.requestMethods).toEqual(["get"]);
  });

  it("fails closed when includes are fully excluded", () => {
    const filters: ProfileFilter[] = [
      { ...createProfileFilter({ id: "include", kind: "method" }), value: "get" },
      {
        ...createProfileFilter({ id: "exclude", kind: "method", mode: "exclude" }),
        value: "get",
      },
    ];

    expect(compileProfileDnrRules(profileWithFilters(filters))).toEqual({
      rules: [],
      diagnostics: ["Method filters exclude every included request method"],
    });
  });

  it.each(invalidEnabledIncludes)(
    "fails closed for an enabled $label include",
    ({ filter, diagnostic }) => {
      expect(compileProfileDnrRules(profileWithFilters([filter]))).toEqual({
        rules: [],
        diagnostics: [diagnostic],
      });
    },
  );

  it("ignores invalid filters when they are disabled", () => {
    const filter = {
      ...createProfileFilter({ id: "disabled-empty-url", kind: "urlPattern" }),
      enabled: false,
    };
    const compilation = compileProfileDnrRules(profileWithFilters([filter]));

    expect(compilation.diagnostics).toEqual([]);
    expect(compilation.rules).toHaveLength(1);
  });

  it("ignores enabled filters without a value", () => {
    const compilation = compileProfileDnrRules(
      profileWithFilters([
        createProfileFilter({ id: "empty-url", kind: "urlPattern" }),
        createProfileFilter({ id: "empty-initiator", kind: "initiator" }),
        createProfileFilter({ id: "unresolved-tab", kind: "tab" }),
      ]),
    );

    expect(compilation.diagnostics).toEqual([]);
    expect(compilation.rules).toHaveLength(1);
  });

  it("creates URL include variants and a higher-priority URL exclude allow rule", () => {
    const filters: ProfileFilter[] = [
      {
        ...createProfileFilter({ id: "include-pattern", kind: "urlPattern" }),
        value: "*://example.com/*",
      },
      {
        ...createProfileFilter({ id: "include-regex", kind: "urlRegex" }),
        value: "^https://api\\.example\\.com/",
      },
      {
        ...createProfileFilter({
          id: "exclude-pattern",
          kind: "urlPattern",
          mode: "exclude",
        }),
        value: "*://example.com/private/*",
      },
    ];
    const rules = profileToDnrRules(profileWithFilters(filters));

    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatchObject({
      id: PROFILE_DNR_RULE_ID_BASE,
      priority: 10000,
      action: { type: "allow" },
      condition: { urlFilter: "*://example.com/private/*" },
    });
    expect(rules[1]).toMatchObject({
      id: PROFILE_DNR_RULE_ID_BASE + 1,
      priority: 1000,
      condition: { urlFilter: "*://example.com/*" },
    });
    expect(rules[2]).toMatchObject({
      id: PROFILE_DNR_RULE_ID_BASE + 2,
      priority: 999,
      condition: { regexFilter: "^https://api\\.example\\.com/" },
    });
  });

  it("keeps valid tab and initiator include/exclude modes separate", () => {
    const filters: ProfileFilter[] = [
      createProfileFilter({ id: "tab", kind: "tab", currentTabId: 42 }),
      {
        ...createProfileFilter({ id: "initiator-include", kind: "initiator" }),
        value: "example.com",
      },
      {
        ...createProfileFilter({
          id: "initiator-exclude",
          kind: "initiator",
          mode: "exclude",
        }),
        value: "blocked.example.com",
      },
    ];
    const rule = modifyHeaderRule(profileWithFilters(filters));

    expect(rule?.condition.tabIds).toEqual([42]);
    expect(rule?.condition.excludedTabIds).toBeUndefined();
    expect(rule?.condition.initiatorDomains).toEqual(["example.com"]);
    expect(rule?.condition.excludedInitiatorDomains).toEqual(["blocked.example.com"]);
  });

  it("does not emit an empty header unless sendEmptyHeader is enabled", () => {
    const base = profileWithFilters([]);
    const skipped = compileProfileDnrRules(
      withRules(base, {
        requestHeaders: [createHeaderRule({ id: "empty-skipped", name: "x-empty", value: "" })],
      }),
    );
    const emitted = compileProfileDnrRules(
      withRules(base, {
        requestHeaders: [
          createHeaderRule({
            id: "empty-emitted",
            name: "x-empty",
            value: "",
            sendEmptyHeader: true,
          }),
        ],
      }),
    );

    expect(skipped).toEqual({ rules: [], diagnostics: [] });
    expect(emitted.diagnostics).toEqual([]);
    expect(emitted.rules).toHaveLength(1);
    expect(emitted.rules[0]).toMatchObject({
      action: {
        type: "modifyHeaders",
        requestHeaders: [{ header: "x-empty", operation: "set", value: "" }],
      },
    });
  });

  it("combines CSP directives into one dedicated response header rule", () => {
    const profile = withRules(profileWithFilters([]), {
      requestHeaders: [],
      responseHeaders: [createHeaderRule({ id: "response-1", name: "x-response", value: "1" })],
      csp: [
        createCspRule({ id: "csp-1", directive: "default-src", value: "'self';" }),
        createCspRule({ id: "csp-2", directive: "script-src", value: "'none'" }),
        createCspRule({ id: "csp-3", directive: "upgrade-insecure-requests" }),
        createCspRule({ id: "csp-draft", directive: "", value: "'self'" }),
        createCspRule({ id: "csp-disabled", directive: "img-src", value: "data:", enabled: false }),
      ],
    });
    const rules = compileProfileDnrRules(profile).rules;

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      action: {
        type: "modifyHeaders",
        responseHeaders: [{ header: "x-response", operation: "set", value: "1" }],
      },
    });
    expect(rules[1]).toMatchObject({
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          {
            header: "Content-Security-Policy",
            operation: "set",
            value: "default-src 'self'; script-src 'none'; upgrade-insecure-requests",
          },
        ],
      },
    });
  });

  it("places the merged CSP rule after ordinary response headers", () => {
    const profile = withRules(profileWithFilters([]), {
      requestHeaders: [],
      responseHeaders: [createHeaderRule({ id: "response", name: "x-response", value: "1" })],
      csp: [
        createCspRule({
          id: "directive-disabled",
          directive: "default-src",
          value: "'self'",
          enabled: false,
        }),
        createCspRule({ id: "directive-active", directive: "script-src", value: "'none'" }),
        createCspRule({ id: "directive-draft", directive: "", value: "'self'" }),
      ],
    });
    const rules = compileProfileDnrRules(profile).rules;

    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      priority: 1000,
      action: {
        responseHeaders: [
          {
            header: "x-response",
            operation: "set",
            value: "1",
          },
        ],
      },
    });
    expect(rules[1]).toMatchObject({
      priority: 999,
      action: {
        responseHeaders: [
          {
            header: "Content-Security-Policy",
            operation: "set",
            value: "script-src 'none'",
          },
        ],
      },
    });
  });

  it("does not emit a CSP header for an empty directive draft", () => {
    const profile = withRules(profileWithFilters([]), {
      requestHeaders: [],
      csp: [createCspRule({ id: "csp-draft", directive: "", value: "'self'" })],
    });

    expect(compileProfileDnrRules(profile)).toEqual({ rules: [], diagnostics: [] });
  });

  it("fails closed when URL includes are combined with redirects", () => {
    const include = {
      ...createProfileFilter({ id: "url-include", kind: "urlPattern" }),
      value: "*://example.com/*",
    };
    const profile = withRules(profileWithFilters([include]), {
      redirects: [
        createRedirectRule({
          id: "redirect-1",
          name: "^https://example\\.com/(.*)$",
          value: "https://mirror.example/$1",
        }),
      ],
    });

    expect(compileProfileDnrRules(profile)).toEqual({
      rules: [],
      diagnostics: [
        "URL include filters cannot be combined safely with redirect regular expressions",
      ],
    });
  });

  it("allocates IDs only for emitted rules and accepts the complete managed range", () => {
    const base = profileWithFilters([]);
    const invalidHeaders = Array.from({ length: 150 }, (_, index) =>
      createHeaderRule({ id: `invalid-${index}`, name: "", value: "1" }),
    );
    const firstValid = profileToDnrRules(
      withRules(base, {
        requestHeaders: [
          ...invalidHeaders,
          createHeaderRule({ id: "valid", name: "x-valid", value: "1" }),
        ],
      }),
    );
    expect(firstValid).toHaveLength(1);
    expect(firstValid[0].id).toBe(PROFILE_DNR_RULE_ID_BASE);

    const fullRange = profileToDnrRules(
      withRules(base, {
        requestHeaders: Array.from({ length: MAX_PROFILE_DNR_RULES }, (_, index) =>
          createHeaderRule({ id: `valid-${index}`, name: `x-valid-${index}`, value: "1" }),
        ),
      }),
    );
    expect(fullRange).toHaveLength(MAX_PROFILE_DNR_RULES);
    expect(fullRange.at(-1)?.id).toBe(PROFILE_DNR_RULE_ID_BASE + MAX_PROFILE_DNR_RULES - 1);
  });

  it("fails the whole profile with a diagnostic when it exceeds the managed range", () => {
    const profile = withRules(profileWithFilters([]), {
      requestHeaders: Array.from({ length: 120 }, (_, index) =>
        createHeaderRule({ id: `valid-${index}`, name: `x-valid-${index}`, value: "1" }),
      ),
    });

    expect(compileProfileDnrRules(profile)).toEqual({
      rules: [],
      diagnostics: [
        `Profile requires 120 DNR rules, exceeding the ${MAX_PROFILE_DNR_RULES} rule limit`,
      ],
    });
  });

  it("assigns stable IDs and priorities in profile order", () => {
    const exclude = {
      ...createProfileFilter({ id: "exclude-private", kind: "urlPattern", mode: "exclude" }),
      value: "*://example.com/private/*",
    };
    const profile = withRules(profileWithFilters([exclude]), {
      requestHeaders: [
        createHeaderRule({ id: "request-1", name: "x-request-1", value: "1" }),
        createHeaderRule({ id: "request-2", name: "x-request-2", value: "2" }),
      ],
      responseHeaders: [createHeaderRule({ id: "response-1", name: "x-response-1", value: "1" })],
      redirects: [
        createRedirectRule({
          id: "redirect-1",
          name: "^https://old-1\\.example/(.*)$",
          value: "https://new-1.example/$1",
        }),
        createRedirectRule({
          id: "redirect-2",
          name: "^https://old-2\\.example/(.*)$",
          value: "https://new-2.example/$1",
        }),
      ],
    });
    const first = compileProfileDnrRules(profile).rules;
    const second = compileProfileDnrRules(profile).rules;

    expect(second).toEqual(first);
    expect(
      first.map((rule) => ({
        id: rule.id,
        priority: rule.priority,
        type: rule.action.type,
      })),
    ).toEqual([
      { id: PROFILE_DNR_RULE_ID_BASE, priority: 10000, type: "allow" },
      { id: PROFILE_DNR_RULE_ID_BASE + 1, priority: 1000, type: "modifyHeaders" },
      { id: PROFILE_DNR_RULE_ID_BASE + 2, priority: 999, type: "modifyHeaders" },
      { id: PROFILE_DNR_RULE_ID_BASE + 3, priority: 998, type: "modifyHeaders" },
      { id: PROFILE_DNR_RULE_ID_BASE + 4, priority: 5000, type: "redirect" },
      { id: PROFILE_DNR_RULE_ID_BASE + 5, priority: 4999, type: "redirect" },
    ]);
  });
});
