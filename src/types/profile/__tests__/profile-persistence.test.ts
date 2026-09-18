import { describe, expect, it } from "vitest";
import {
  createCookieRule,
  createCspRule,
  createHeaderRule,
  createProfile,
  createRedirectRule,
} from "../profile-factory";
import { createProfileFilter } from "../profile-filter";
import { reduceProfileCommand } from "../../../services/profile/reduce-profile-command";
import type { ProfileCommand } from "../../../services/profile/profile-command";
import {
  fromPersistedState,
  isPersistedProfileState,
  toPersistedState,
} from "../profile-persistence";
import { createProfileDocument } from "../profile-document";
import { isProfileDocument } from "../profile-validation";

describe("profile persistence identity", () => {
  it("keeps profile identity stable across canonical storage round-trips", () => {
    const profile = createProfile({ title: "Test" });
    profile.rules.requestHeaders.push(createHeaderRule({ name: "x-test" }));

    const persisted = toPersistedState([profile], profile.id, false);
    const firstRead = fromPersistedState(persisted).profiles[0];
    const secondRead = fromPersistedState(persisted).profiles[0];

    expect(firstRead.id).toBe(profile.id);
    expect(secondRead.id).toBe(profile.id);
    expect(firstRead.rules.requestHeaders.map((rule) => rule.id)).toEqual(
      profile.rules.requestHeaders.map((rule) => rule.id),
    );
    expect(secondRead.rules.requestHeaders.map((rule) => rule.id)).toEqual(
      firstRead.rules.requestHeaders.map((rule) => rule.id),
    );
  });

  it("preserves profile runtime state across canonical storage round-trips", () => {
    const profile = createProfile({ title: "Runtime state" });
    profile.enabled = false;
    profile.paused = true;
    const restored = fromPersistedState(toPersistedState([profile], profile.id, false)).profiles[0];

    expect(restored).toMatchObject({ enabled: false, paused: true });
  });

  it("restores cookies as NameValueRule objects without header-only fields", () => {
    const profile = createProfile({ title: "Cookies" });
    profile.rules.cookies.push(createCookieRule({ name: "session", value: "abc" }));

    const persisted = toPersistedState([profile], profile.id, false);
    const restored = fromPersistedState(persisted).profiles[0];
    const document = createProfileDocument(
      { profiles: [restored], selectedProfileId: restored.id },
      "test",
      1,
    );

    expect(restored.rules.cookies[0]).toEqual({
      id: profile.rules.cookies[0].id,
      enabled: true,
      name: "session",
      value: "abc",
      comment: "",
    });
    expect(isProfileDocument(document)).toBe(true);
  });

  it("keeps every editor add-rule collection valid after a storage round-trip", () => {
    const cases = [
      ["requestHeaders", createHeaderRule({ name: "x-request" })],
      ["responseHeaders", createHeaderRule({ name: "x-response" })],
      ["csp", createCspRule({ directive: "default-src", value: "'self'" })],
      ["cookies", createCookieRule({ name: "session", value: "abc" })],
      ["redirects", createRedirectRule({ name: "^https://old.example" })],
    ] as const;

    for (const [collection, rule] of cases) {
      const profile = createProfile({ title: collection });
      const current = createProfileDocument(
        { profiles: [profile], selectedProfileId: profile.id },
        "test",
        1,
      );
      const result = reduceProfileCommand(
        current,
        { type: "addRule", profileId: profile.id, collection, rule } as ProfileCommand,
        "test",
      );
      expect(result.status).toBe("applied");
      if (result.status !== "applied") continue;

      const persisted = toPersistedState(
        result.document.state.profiles,
        result.document.state.selectedProfileId,
        false,
      );
      const restored = fromPersistedState(persisted).profiles[0];
      expect(
        isProfileDocument(
          createProfileDocument(
            { profiles: [restored], selectedProfileId: restored.id },
            "test",
            2,
          ),
        ),
      ).toBe(true);
    }
  });

  it("persists method and excluded initiator filters", () => {
    const profile = createProfile({ title: "Filters" });
    const method = createProfileFilter({ kind: "method", mode: "include" });
    const excludedInitiator = createProfileFilter({ kind: "initiator", mode: "exclude" });
    profile.filters = [method, excludedInitiator];

    const persisted = toPersistedState([profile], profile.id, false);
    expect(persisted.profiles[0].filters).toHaveLength(2);

    const restored = fromPersistedState(persisted).profiles[0];
    expect(restored.filters).toHaveLength(2);
    expect(restored.filters.map((filter) => [filter.kind, filter.mode])).toEqual(
      profile.filters.map((filter) => [filter.kind, filter.mode]),
    );
  });

  it("preserves the global pause state across commands", () => {
    const profile = createProfile({ title: "Paused" });
    const current = createProfileDocument(
      { profiles: [profile], selectedProfileId: profile.id },
      "test",
      1,
      true,
    );
    const result = reduceProfileCommand(
      current,
      { type: "patchProfile", profileId: profile.id, patch: { title: "Updated" } },
      "test",
    );

    expect(result.status).toBe("applied");
    expect(result.document.isPaused).toBe(true);
  });

  it("rejects persisted profiles with malformed nested entries", () => {
    const profile = createProfile({ title: "Validated" });
    const persisted = toPersistedState([profile], profile.id, false);

    expect(
      isPersistedProfileState({
        ...persisted,
        profiles: [
          {
            ...persisted.profiles[0],
            rules: { ...persisted.profiles[0].rules, requestHeaders: [{}] },
          },
        ],
      }),
    ).toBe(false);
  });
});
