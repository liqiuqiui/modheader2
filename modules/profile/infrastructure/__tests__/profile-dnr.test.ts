import { describe, expect, it } from "vitest";
import {
  createHeaderRule,
  createProfile,
  createUrlReplacement,
} from "../../domain/profile-factory";
import { createProfileFilter } from "../../domain/profile-filter";
import type { Profile, ProfileFilter } from "../../domain/profile-model";
import {
  compileProfileDnrRules,
  MAX_PROFILE_DNR_RULES,
  PROFILE_DNR_RULE_ID_BASE,
  profileToDnrRules,
} from "../profile-dnr";

function profileWithFilters(filters: ProfileFilter[]): Profile {
  const profile = createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" });
  return {
    ...profile,
    headers: [createHeaderRule({ id: "header-1", name: "x-test", value: "1" })],
    filters: {
      byId: Object.fromEntries(filters.map((filter) => [filter.id, filter])),
      order: filters.map((filter) => filter.id),
    },
  };
}

function modifyHeaderRule(profile: Profile) {
  return compileProfileDnrRules(profile).rules.find((rule) => rule.action.type === "modifyHeaders");
}

const invalidEnabledIncludes: Array<{
  label: string;
  filter: ProfileFilter;
  diagnostic: string;
}> = [
  {
    label: "empty URL pattern",
    filter: createProfileFilter({ id: "empty-url", kind: "urlPattern" }),
    diagnostic: "An enabled URL filter is empty or contains non-ASCII characters",
  },
  {
    label: "invalid URL regular expression",
    filter: {
      ...createProfileFilter({ id: "invalid-regex", kind: "urlRegex" }),
      value: "(",
    },
    diagnostic: "An enabled URL regex filter is invalid",
  },
  {
    label: "empty initiator",
    filter: createProfileFilter({ id: "empty-initiator", kind: "initiator" }),
    diagnostic: "An enabled initiator filter has an invalid domain",
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
    label: "unresolved tab",
    filter: createProfileFilter({ id: "unresolved-tab", kind: "tab" }),
    diagnostic: "An enabled tab filter has no valid tab",
  },
];

describe("Profile DNR compilation", () => {
  it("returns no rules for disabled or paused profiles", () => {
    const profile = profileWithFilters([]);

    expect(profileToDnrRules({ ...profile, enabled: false })).toEqual([]);
    expect(profileToDnrRules({ ...profile, paused: true })).toEqual([]);
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
    const skipped = compileProfileDnrRules({
      ...base,
      headers: [createHeaderRule({ id: "empty-skipped", name: "x-empty", value: "" })],
    });
    const emitted = compileProfileDnrRules({
      ...base,
      headers: [
        createHeaderRule({
          id: "empty-emitted",
          name: "x-empty",
          value: "",
          sendEmptyHeader: true,
        }),
      ],
    });

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

  it("fails closed when URL includes are combined with redirects", () => {
    const include = {
      ...createProfileFilter({ id: "url-include", kind: "urlPattern" }),
      value: "*://example.com/*",
    };
    const profile = {
      ...profileWithFilters([include]),
      urlReplacements: [
        createUrlReplacement({
          id: "redirect-1",
          name: "^https://example\\.com/(.*)$",
          value: "https://mirror.example/$1",
        }),
      ],
    };

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
    const firstValid = profileToDnrRules({
      ...base,
      headers: [...invalidHeaders, createHeaderRule({ id: "valid", name: "x-valid", value: "1" })],
    });
    expect(firstValid).toHaveLength(1);
    expect(firstValid[0].id).toBe(PROFILE_DNR_RULE_ID_BASE);

    const fullRange = profileToDnrRules({
      ...base,
      headers: Array.from({ length: MAX_PROFILE_DNR_RULES }, (_, index) =>
        createHeaderRule({ id: `valid-${index}`, name: `x-valid-${index}`, value: "1" }),
      ),
    });
    expect(fullRange).toHaveLength(MAX_PROFILE_DNR_RULES);
    expect(fullRange.at(-1)?.id).toBe(PROFILE_DNR_RULE_ID_BASE + MAX_PROFILE_DNR_RULES - 1);
  });

  it("fails the whole profile with a diagnostic when it exceeds the managed range", () => {
    const profile = {
      ...profileWithFilters([]),
      headers: Array.from({ length: 120 }, (_, index) =>
        createHeaderRule({ id: `valid-${index}`, name: `x-valid-${index}`, value: "1" }),
      ),
    };

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
    const profile: Profile = {
      ...profileWithFilters([exclude]),
      headers: [
        createHeaderRule({ id: "request-1", name: "x-request-1", value: "1" }),
        createHeaderRule({ id: "request-2", name: "x-request-2", value: "2" }),
      ],
      respHeaders: [createHeaderRule({ id: "response-1", name: "x-response-1", value: "1" })],
      urlReplacements: [
        createUrlReplacement({
          id: "redirect-1",
          name: "^https://old-1\\.example/(.*)$",
          value: "https://new-1.example/$1",
        }),
        createUrlReplacement({
          id: "redirect-2",
          name: "^https://old-2\\.example/(.*)$",
          value: "https://new-2.example/$1",
        }),
      ],
    };
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
