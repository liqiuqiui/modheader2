import { describe, expect, it } from "vitest";
import {
  createCookieRule,
  createHeaderRule,
  createProfile,
  createRedirectRule,
} from "../../../types/profile/profile-factory";
import { checkHeaderName } from "../../../types/profile/profile-header-name";
import type { Profile } from "../../../types/profile/profile-model";
import { createProfileDocument } from "../../../types/profile/profile-document";
import {
  activeProfiles,
  compileActiveProfilesDnrRules,
  compileProfileDnrRules,
  MAX_PROFILE_DNR_RULES,
  PROFILE_DNR_RULE_ID_BASE,
} from "../profile-dnr";

function baseProfile(overrides?: Partial<Profile>): Profile {
  const profile = createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" });
  return { ...profile, ...overrides };
}

function withHeader(profile: Profile, rule: Partial<Parameters<typeof createHeaderRule>[0]>) {
  return {
    ...profile,
    rules: { ...profile.rules, requestHeaders: [createHeaderRule(rule)] },
  };
}

function headerActions(profile: Profile) {
  return compileProfileDnrRules(profile)
    .rules.filter((rule) => rule.action.type === "modifyHeaders")
    .flatMap((rule) => rule.action.requestHeaders ?? []);
}

describe("header remove operation", () => {
  it("compiles an empty value with remove mode to a DNR remove action", () => {
    const profile = withHeader(baseProfile(), {
      name: "x-remove-me",
      value: "",
      appendMode: "remove",
    });

    expect(headerActions(profile)).toEqual([{ header: "x-remove-me", operation: "remove" }]);
  });

  it("omits the value field entirely, since DNR rejects a value on remove", () => {
    const profile = withHeader(baseProfile(), {
      name: "x-remove-me",
      value: "",
      appendMode: "remove",
    });

    const action = headerActions(profile)[0];
    expect(action).not.toHaveProperty("value");
  });

  it("keeps a remove rule effective even though it carries no value", () => {
    // Regression guard: the rule used to be dropped here, so the header the
    // user asked to delete kept being sent.
    const profile = withHeader(baseProfile(), {
      name: "x-remove-me",
      value: "",
      appendMode: "remove",
    });

    expect(compileProfileDnrRules(profile).rules).toHaveLength(1);
  });

  it("still drops a value-less rule that is not in remove mode", () => {
    const profile = withHeader(baseProfile(), {
      name: "x-nothing",
      value: "",
      appendMode: "override",
    });

    expect(compileProfileDnrRules(profile).rules).toHaveLength(0);
  });

  it("removes response headers too", () => {
    const profile = baseProfile();
    const withResponse = {
      ...profile,
      rules: {
        ...profile.rules,
        responseHeaders: [
          createHeaderRule({ name: "x-response", appendMode: "remove", value: "" }),
        ],
      },
    };

    const rule = compileProfileDnrRules(withResponse).rules[0];
    expect(rule.action.responseHeaders).toEqual([{ header: "x-response", operation: "remove" }]);
  });
});

describe("comma append resolution", () => {
  it("resolves the stored comma mode to a plain append operation", () => {
    // DNR has no comma-join operation, so `comma` can only ever mean `append`.
    const profile = withHeader(baseProfile(), {
      name: "accept",
      value: "text/html",
      appendMode: "comma",
    });

    expect(headerActions(profile)).toEqual([
      { header: "accept", operation: "append", value: "text/html" },
    ]);
  });

  it("does not inject a comma separator into the value", () => {
    const profile = withHeader(baseProfile(), {
      name: "accept",
      value: "text/html",
      appendMode: "comma",
    });

    expect(headerActions(profile)[0].value).toBe("text/html");
  });
});

describe("header name validation", () => {
  it("rejects a name with characters outside the RFC token set", () => {
    const profile = withHeader(baseProfile(), { name: "bad header", value: "1" });

    const compilation = compileProfileDnrRules(profile);
    expect(compilation.rules).toHaveLength(0);
    expect(compilation.diagnostics[0]).toContain("not a valid header name");
  });

  it("rejects browser-owned headers and names them in the diagnostic", () => {
    const profile = withHeader(baseProfile(), { name: "Host", value: "evil.example" });

    const compilation = compileProfileDnrRules(profile);
    expect(compilation.rules).toHaveLength(0);
    expect(compilation.diagnostics[0]).toContain("managed by the browser");
  });

  it("accepts credential headers, which are legitimate to override", () => {
    const profile = withHeader(baseProfile(), { name: "Authorization", value: "Bearer x" });

    expect(compileProfileDnrRules(profile).rules).toHaveLength(1);
  });

  it("classifies an empty name separately from a malformed one", () => {
    expect(checkHeaderName("").problem).toBe("empty");
    expect(checkHeaderName("a b").problem).toBe("syntax");
    expect(checkHeaderName(":authority").problem).toBe("protected");
    expect(checkHeaderName("X-Api-Key").ok).toBe(true);
  });
});

describe("cookie write modes", () => {
  it("merges set-mode cookies into a single set action", () => {
    const profile = baseProfile();
    const withCookies = {
      ...profile,
      rules: {
        ...profile.rules,
        cookies: [
          createCookieRule({ name: "a", value: "1", writeMode: "set" }),
          createCookieRule({ name: "b", value: "2", writeMode: "set" }),
        ],
      },
    };

    const cookieRules = compileProfileDnrRules(withCookies)
      .rules.filter((rule) => rule.action.requestHeaders?.some((h) => h.header === "cookie"))
      .flatMap((rule) => rule.action.requestHeaders ?? []);

    expect(cookieRules).toEqual([{ header: "cookie", operation: "set", value: "a=1; b=2" }]);
  });

  it("emits append-mode cookies as an append action so site cookies survive", () => {
    const profile = baseProfile();
    const withCookies = {
      ...profile,
      rules: {
        ...profile.rules,
        cookies: [createCookieRule({ name: "token", value: "x", writeMode: "append" })],
      },
    };

    const cookieRules = compileProfileDnrRules(withCookies).rules.flatMap(
      (rule) => rule.action.requestHeaders ?? [],
    );

    expect(cookieRules).toEqual([{ header: "cookie", operation: "append", value: "token=x" }]);
  });

  it("keeps set and append in separate rules so append is not wiped", () => {
    const profile = baseProfile();
    const withCookies = {
      ...profile,
      rules: {
        ...profile.rules,
        cookies: [
          createCookieRule({ name: "a", value: "1", writeMode: "set" }),
          createCookieRule({ name: "b", value: "2", writeMode: "append" }),
        ],
      },
    };

    const cookieRules = compileProfileDnrRules(withCookies).rules.flatMap(
      (rule) => rule.action.requestHeaders ?? [],
    );

    expect(cookieRules).toEqual([
      { header: "cookie", operation: "set", value: "a=1" },
      { header: "cookie", operation: "append", value: "b=2" },
    ]);
  });

  it("writes Set-Cookie rules to the response header", () => {
    const profile = baseProfile();
    const withSetCookies = {
      ...profile,
      rules: {
        ...profile.rules,
        setCookies: [
          createCookieRule({ name: "sid", value: "abc" }),
          createCookieRule({ name: "theme", value: "dark" }),
        ],
      },
    };

    const setCookieRules = compileProfileDnrRules(withSetCookies)
      .rules.filter((rule) => rule.action.responseHeaders?.some((h) => h.header === "set-cookie"))
      .flatMap((rule) => rule.action.responseHeaders ?? []);

    // Repeated Set-Cookie headers stay separate lines instead of one joined value.
    expect(setCookieRules).toEqual([
      { header: "set-cookie", operation: "set", value: "sid=abc" },
      { header: "set-cookie", operation: "set", value: "theme=dark" },
    ]);
  });

  it("drops a cookie whose value cannot be serialized into a cookie header", () => {
    const profile = baseProfile();
    const withCookies = {
      ...profile,
      rules: {
        ...profile.rules,
        cookies: [createCookieRule({ name: "bad", value: "a;b", writeMode: "set" })],
      },
    };

    expect(compileProfileDnrRules(withCookies).rules).toHaveLength(0);
  });
});

describe("global pause", () => {
  const document = createProfileDocument(
    {
      profiles: [baseProfile({ id: "a" }), { ...baseProfile({ id: "b" }), alwaysOn: true }],
      selectedProfileId: "a",
    },
    "test",
    1,
    false,
  );

  it("compiles no rules at all when globally paused", () => {
    const paused = createProfileDocument(document.state, "test", 1, true);
    expect(compileActiveProfilesDnrRules(paused).rules).toHaveLength(0);
  });

  it("ignores alwaysOn profiles while globally paused", () => {
    const paused = createProfileDocument(document.state, "test", 1, true);
    expect(activeProfiles(paused)).toEqual([]);
  });

  it("produces no rules for a globally paused document", () => {
    const paused = createProfileDocument(document.state, "test", 1, true);
    expect(compileActiveProfilesDnrRules(paused).rules).toHaveLength(0);
  });
});

describe("alwaysOn profiles", () => {
  /** Both profiles carry one header rule, so the merged count is predictable. */
  function withSharedHeader(profile: Profile): Profile {
    return {
      ...profile,
      rules: {
        ...profile.rules,
        requestHeaders: [createHeaderRule({ name: "x-shared", value: "1" })],
      },
    };
  }

  function twoProfileDocument(alwaysOn: boolean, selectedId = "a") {
    return createProfileDocument(
      {
        profiles: [
          withSharedHeader(baseProfile({ id: "a" })),
          { ...withSharedHeader(baseProfile({ id: "b" })), alwaysOn },
        ],
        selectedProfileId: selectedId,
      },
      "test",
      1,
      false,
    );
  }

  it("compiles the selected profile plus every alwaysOn profile", () => {
    expect(activeProfiles(twoProfileDocument(true)).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("excludes non-selected profiles without alwaysOn", () => {
    expect(activeProfiles(twoProfileDocument(false)).map((p) => p.id)).toEqual(["a"]);
  });

  it("merges rules from both profiles with unique ids", () => {
    const rules = compileActiveProfilesDnrRules(twoProfileDocument(true)).rules;

    expect(rules).toHaveLength(2);
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(2);
    expect(rules.every((rule) => rule.id >= PROFILE_DNR_RULE_ID_BASE)).toBe(true);
  });

  it("keeps compiling an alwaysOn profile when another one is selected", () => {
    // "b" is selected and "a" is alwaysOn, so both still apply.
    const document = twoProfileDocument(true, "b");
    expect(activeProfiles(document).map((profile) => profile.id)).toEqual(["b"]);
  });

  it("skips a paused alwaysOn profile", () => {
    const document = createProfileDocument(
      {
        profiles: [
          baseProfile({ id: "a" }),
          { ...baseProfile({ id: "b" }), alwaysOn: true, paused: true },
        ],
        selectedProfileId: "a",
      },
      "test",
      1,
      false,
    );

    expect(activeProfiles(document).map((profile) => profile.id)).toEqual(["a"]);
  });

  it("fails closed when the combined rule count exceeds the limit", () => {
    const many = Array.from({ length: MAX_PROFILE_DNR_RULES + 1 }, (_, index) =>
      createHeaderRule({ name: `x-${index}`, value: "1" }),
    );
    const document = createProfileDocument(
      {
        profiles: [
          { ...baseProfile({ id: "a" }), rules: { ...baseProfile().rules, requestHeaders: many } },
          {
            ...baseProfile({ id: "b" }),
            alwaysOn: true,
            rules: {
              ...baseProfile().rules,
              redirects: [createRedirectRule({ name: "a", value: "b" })],
            },
          },
        ],
        selectedProfileId: "a",
      },
      "test",
      1,
      false,
    );

    const compilation = compileActiveProfilesDnrRules(document);
    expect(compilation.rules).toHaveLength(0);
    expect(compilation.diagnostics[0]).toContain("exceeding");
  });
});
