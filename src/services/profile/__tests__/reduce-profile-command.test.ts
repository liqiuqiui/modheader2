import { describe, expect, it } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
  type ProfileDocument,
} from "../../../types/profile/profile-document";
import { createHeaderRule, createProfile } from "../../../types/profile/profile-factory";
import { createProfileFilter } from "../../../types/profile/profile-filter";
import type { Profile } from "../../../types/profile/profile-model";
import type { ProfileCommand } from "../profile-command";
import { reduceProfileCommand, type ProfileCommandResult } from "../reduce-profile-command";

function profileWithHeader(): Profile {
  const profile = createProfile({
    title: "Test",
    id: "profile-1",
    backgroundColor: "#2563eb",
  });
  return {
    ...profile,
    rules: {
      ...profile.rules,
      requestHeaders: [createHeaderRule({ id: "header-1", name: "x-test", value: "before" })],
    },
  };
}

function applied(result: ProfileCommandResult): ProfileDocument {
  expect(result.status).toBe("applied");
  return result.document;
}

function profileOf(document: ProfileDocument, profileId = "profile-1"): Profile {
  const profile = document.state.profiles.find((item) => item.id === profileId);
  expect(profile).toBeDefined();
  return profile as Profile;
}

describe("reduceProfileCommand", () => {
  it("initializes schema 1 once and increments revision exactly once", () => {
    const profile = profileWithHeader();
    const initialized = applied(
      reduceProfileCommand(
        createEmptyProfileDocument(),
        { type: "initialize", profile },
        "client-a",
      ),
    );

    expect(initialized).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      sourceId: "client-a",
      state: { profiles: [profile], selectedProfileId: profile.id },
    });

    const second = reduceProfileCommand(
      initialized,
      { type: "initialize", profile: createProfile({ title: "Ignored" }) },
      "client-b",
    );
    expect(second).toEqual({ status: "noop", document: initialized });
    expect(second.document).toBe(initialized);
  });

  it("keeps no-ops reference-stable", () => {
    const document = createInitialProfileDocument(profileWithHeader(), "seed", 4);
    const result = reduceProfileCommand(
      document,
      {
        type: "patchProfile",
        profileId: "profile-1",
        patch: { title: "Test" },
      },
      "client-a",
    );

    expect(result).toEqual({ status: "noop", document });
    expect(result.document).toBe(document);
  });

  it("returns an explicit revision conflict for stale destructive commands", () => {
    const document = createInitialProfileDocument(profileWithHeader(), "seed", 7);
    const result = reduceProfileCommand(
      document,
      {
        type: "clearRules",
        profileId: "profile-1",
        collection: "requestHeaders",
        expectedRevision: 6,
      },
      "client-a",
    );

    expect(result).toEqual({
      status: "revision-conflict",
      document,
      expected: 6,
      actual: 7,
    });
  });

  it("does not let a malformed protected command bypass revision checks", () => {
    const document = createInitialProfileDocument(profileWithHeader(), "seed", 7);
    const malformed = {
      type: "clearRules",
      profileId: "profile-1",
      collection: "requestHeaders",
    } as unknown as ProfileCommand;

    const result = reduceProfileCommand(document, malformed, "client-a");

    expect(result).toEqual({ status: "noop", document });
  });

  it("accepts only a strict state payload for history replacement", () => {
    const document = createInitialProfileDocument(profileWithHeader(), "seed", 7);
    const malformedState = {
      ...document.state,
      revision: 1,
      sourceId: "injected",
    };

    const rejected = reduceProfileCommand(
      document,
      {
        type: "replaceState",
        state: malformedState as never,
        expectedRevision: document.revision,
      },
      "client-a",
    );
    expect(rejected).toEqual({ status: "noop", document });

    const replacement = createProfile({
      id: "profile-2",
      title: "Replacement",
      backgroundColor: "#16a34a",
    });
    const replaced = applied(
      reduceProfileCommand(
        document,
        {
          type: "replaceState",
          state: { profiles: [replacement], selectedProfileId: replacement.id },
          expectedRevision: document.revision,
        },
        "client-a",
      ),
    );
    expect(replaced).toMatchObject({
      revision: 8,
      sourceId: "client-a",
      state: { profiles: [replacement], selectedProfileId: replacement.id },
    });
  });

  it("merges entity-level patch and add commands in either order", () => {
    const initial = createInitialProfileDocument(profileWithHeader(), "seed", 1);
    const patch: ProfileCommand = {
      type: "patchRule",
      profileId: "profile-1",
      collection: "requestHeaders",
      ruleId: "header-1",
      patch: { value: "after" },
    };
    const add: ProfileCommand = {
      type: "addRule",
      profileId: "profile-1",
      collection: "requestHeaders",
      rule: createHeaderRule({ id: "header-2", name: "x-added", value: "2" }),
    };

    const patchThenAdd = applied(
      reduceProfileCommand(applied(reduceProfileCommand(initial, patch, "a")), add, "b"),
    );
    const addThenPatch = applied(
      reduceProfileCommand(applied(reduceProfileCommand(initial, add, "b")), patch, "a"),
    );

    for (const document of [patchThenAdd, addThenPatch]) {
      expect(profileOf(document).rules.requestHeaders).toEqual([
        expect.objectContaining({ id: "header-1", value: "after" }),
        expect.objectContaining({ id: "header-2", value: "2" }),
      ]);
      expect(document.revision).toBe(3);
    }
  });

  it("preserves a header patch across concurrent conversion orderings", () => {
    const initial = createInitialProfileDocument(profileWithHeader(), "seed", 1);
    const convert: ProfileCommand = {
      type: "convertHeader",
      profileId: "profile-1",
      ruleId: "header-1",
      target: "responseHeaders",
    };
    const staleCollectionPatch: ProfileCommand = {
      type: "patchRule",
      profileId: "profile-1",
      collection: "requestHeaders",
      ruleId: "header-1",
      patch: { value: "after" },
    };

    const convertedThenPatched = applied(
      reduceProfileCommand(
        applied(reduceProfileCommand(initial, convert, "a")),
        staleCollectionPatch,
        "b",
      ),
    );
    const patchedThenConverted = applied(
      reduceProfileCommand(
        applied(reduceProfileCommand(initial, staleCollectionPatch, "b")),
        convert,
        "a",
      ),
    );

    for (const document of [convertedThenPatched, patchedThenConverted]) {
      const profile = profileOf(document);
      expect(profile.rules.requestHeaders).toEqual([]);
      expect(profile.rules.responseHeaders).toEqual([
        expect.objectContaining({ id: "header-1", value: "after" }),
      ]);
    }
  });

  it("moves a response CSP header into the dedicated CSP collection", () => {
    const initialProfile = profileWithHeader();
    initialProfile.rules.requestHeaders = [];
    initialProfile.rules.responseHeaders = [
      createHeaderRule({ id: "response-1", name: "x-frame-options", value: "DENY" }),
    ];
    const initial = createInitialProfileDocument(initialProfile, "seed", 1);

    const document = applied(
      reduceProfileCommand(
        initial,
        {
          type: "patchRule",
          profileId: initialProfile.id,
          collection: "responseHeaders",
          ruleId: "response-1",
          patch: {
            name: "Content-Security-Policy",
            value: "default-src 'self'",
          },
        },
        "client-a",
      ),
    );

    const profile = profileOf(document);
    expect(profile.rules.responseHeaders).toEqual([]);
    expect(profile.rules.csp).toEqual([
      expect.objectContaining({
        id: "response-1",
        directive: "default-src",
        value: "'self'",
      }),
    ]);
  });

  it("uses the replacement only when deleting the final profile", () => {
    const first = profileWithHeader();
    const second = createProfile({
      id: "profile-2",
      title: "Second",
      backgroundColor: "#16a34a",
    });
    const replacement = createProfile({
      id: "profile-3",
      title: "Replacement",
      backgroundColor: "#0f766e",
    });
    const withTwoProfiles = {
      ...createInitialProfileDocument(first, "seed", 1),
      state: { profiles: [first, second], selectedProfileId: first.id },
    };

    const deleted = applied(
      reduceProfileCommand(
        withTwoProfiles,
        { type: "deleteProfile", profileId: first.id, replacement },
        "client-a",
      ),
    );
    expect(deleted.state).toEqual({ profiles: [second], selectedProfileId: second.id });

    const replaced = applied(
      reduceProfileCommand(
        deleted,
        { type: "deleteProfile", profileId: second.id, replacement },
        "client-a",
      ),
    );
    expect(replaced.state).toEqual({
      profiles: [replacement],
      selectedProfileId: replacement.id,
    });
  });

  it("updates array filters without replacing sibling entities", () => {
    const initial = createInitialProfileDocument(profileWithHeader(), "seed", 1);
    const first = createProfileFilter({ id: "filter-1", kind: "method" });
    const second = createProfileFilter({ id: "filter-2", kind: "resourceType" });
    const withFirst = applied(
      reduceProfileCommand(
        initial,
        { type: "addFilter", profileId: "profile-1", filter: first },
        "a",
      ),
    );
    const withBoth = applied(
      reduceProfileCommand(
        withFirst,
        { type: "addFilter", profileId: "profile-1", filter: second },
        "b",
      ),
    );
    const patched = applied(
      reduceProfileCommand(
        withBoth,
        {
          type: "patchFilter",
          profileId: "profile-1",
          filterId: first.id,
          expectedKind: first.kind,
          patch: { mode: "exclude" },
        },
        "a",
      ),
    );

    expect(profileOf(patched).filters).toEqual([{ ...first, mode: "exclude" }, second]);
  });

  it("defaults a changed filter kind to the group or window id from the command", () => {
    const filter = createProfileFilter({ id: "filter-1", kind: "urlPattern" });
    const initialProfile = profileWithHeader();
    initialProfile.filters = [filter];
    const initial = createInitialProfileDocument(initialProfile, "seed", 1);
    const target = { currentTabId: 42, groupId: 7, windowId: 3 };

    const changeKind = (kind: "tab" | "tabGroup" | "window") =>
      profileOf(
        applied(
          reduceProfileCommand(
            initial,
            {
              type: "changeFilterKind",
              profileId: initialProfile.id,
              filterId: filter.id,
              kind,
              ...target,
            },
            "a",
          ),
        ),
      ).filters[0];

    expect(changeKind("tab")).toMatchObject({ kind: "tab", value: 42 });
    expect(changeKind("tabGroup")).toMatchObject({ kind: "tabGroup", value: 7 });
    expect(changeKind("window")).toMatchObject({ kind: "window", value: 3 });
  });

  it("makes stale filter value patches commute with kind changes", () => {
    const filter = {
      ...createProfileFilter({ id: "filter-1", kind: "urlPattern" }),
      value: "*://before/*",
    };
    const initialProfile = profileWithHeader();
    initialProfile.filters = [filter];
    const initial = createInitialProfileDocument(initialProfile, "seed", 1);
    const changeKind: ProfileCommand = {
      type: "changeFilterKind",
      profileId: initialProfile.id,
      filterId: filter.id,
      kind: "initiator",
    };
    const stalePatch: ProfileCommand = {
      type: "patchFilter",
      profileId: initialProfile.id,
      filterId: filter.id,
      expectedKind: "urlPattern",
      patch: { value: "*://stale/*" },
    };

    const changedThenPatched = reduceProfileCommand(
      applied(reduceProfileCommand(initial, changeKind, "a")),
      stalePatch,
      "b",
    ).document;
    const patchedThenChanged = applied(
      reduceProfileCommand(
        applied(reduceProfileCommand(initial, stalePatch, "b")),
        changeKind,
        "a",
      ),
    );

    for (const document of [changedThenPatched, patchedThenChanged]) {
      expect(profileOf(document).filters[0]).toMatchObject({
        id: filter.id,
        kind: "initiator",
        value: "",
      });
    }
  });
});
