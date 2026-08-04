import { describe, expect, it } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
} from "../../domain/profile-document";
import { createHeaderRule, createProfile } from "../../domain/profile-factory";
import { createProfileFilter } from "../../domain/profile-filter";
import type { Profile } from "../../domain/profile-model";
import type { ProfileCommand } from "../profile-command";
import { reduceProfileCommand, type ProfileCommandResult } from "../reduce-profile-command";

function profileWithHeader(): Profile {
  return {
    ...createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" }),
    headers: [createHeaderRule({ id: "header-1", name: "x-test", value: "before" })],
  };
}

function applied(result: ProfileCommandResult) {
  expect(result.status).toBe("applied");
  return result.document;
}

describe("reduceProfileCommand", () => {
  it("initializes schema v2 once and increments revision exactly once", () => {
    const profile = profileWithHeader();
    const first = reduceProfileCommand(
      createEmptyProfileDocument(),
      { type: "initialize", profile },
      "client-a",
    );
    const initialized = applied(first);

    expect(initialized.revision).toBe(1);
    expect(initialized.sourceId).toBe("client-a");
    expect(initialized.selectedProfileId).toBe(profile.id);
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
        collection: "headers",
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
      collection: "headers",
    } as unknown as ProfileCommand;
    const result = reduceProfileCommand(document, malformed, "client-a");

    expect(result).toEqual({ status: "noop", document });
    expect(result.document).toBe(document);
  });

  it("does not let snapshot payloads override document metadata", () => {
    const document = createInitialProfileDocument(profileWithHeader(), "seed", 7);
    const snapshot = {
      profilesById: document.profilesById,
      profileOrder: document.profileOrder,
      selectedProfileId: document.selectedProfileId,
      revision: 1,
      sourceId: "injected",
      schemaVersion: 1,
    };
    const result = reduceProfileCommand(
      document,
      {
        type: "replaceSnapshot",
        snapshot: snapshot as never,
        expectedRevision: document.revision,
      },
      "client-a",
    );

    expect(result).toEqual({ status: "noop", document });
  });

  it("merges entity-level patch and add commands in either order", () => {
    const initial = createInitialProfileDocument(profileWithHeader(), "seed", 1);
    const patch: ProfileCommand = {
      type: "patchRule",
      profileId: "profile-1",
      collection: "headers",
      ruleId: "header-1",
      patch: { value: "after" },
    };
    const add: ProfileCommand = {
      type: "addRule",
      profileId: "profile-1",
      collection: "headers",
      rule: createHeaderRule({ id: "header-2", name: "x-added", value: "2" }),
    };

    const patchThenAdd = applied(
      reduceProfileCommand(applied(reduceProfileCommand(initial, patch, "a")), add, "b"),
    );
    const addThenPatch = applied(
      reduceProfileCommand(applied(reduceProfileCommand(initial, add, "b")), patch, "a"),
    );

    for (const document of [patchThenAdd, addThenPatch]) {
      expect(document.profilesById["profile-1"].headers).toEqual([
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
      target: "respHeaders",
    };
    const staleCollectionPatch: ProfileCommand = {
      type: "patchRule",
      profileId: "profile-1",
      collection: "headers",
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
      const profile = document.profilesById["profile-1"];
      expect(profile.headers).toEqual([]);
      expect(profile.respHeaders).toEqual([
        expect.objectContaining({ id: "header-1", value: "after" }),
      ]);
    }
  });

  it("updates normalized filters without replacing another command's entities", () => {
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

    expect(patched.profilesById["profile-1"].filters.order).toEqual([first.id, second.id]);
    expect(patched.profilesById["profile-1"].filters.byId[first.id].mode).toBe("exclude");
    expect(patched.profilesById["profile-1"].filters.byId[second.id]).toEqual(second);
  });

  it("makes stale filter value patches commute with kind changes", () => {
    const filter = {
      ...createProfileFilter({ id: "filter-1", kind: "urlPattern" }),
      value: "*://before/*",
    };
    const initialProfile = profileWithHeader();
    initialProfile.filters = { byId: { [filter.id]: filter }, order: [filter.id] };
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
      expect(document.profilesById[initialProfile.id].filters.byId[filter.id]).toMatchObject({
        kind: "initiator",
        value: "",
      });
    }
  });
});
