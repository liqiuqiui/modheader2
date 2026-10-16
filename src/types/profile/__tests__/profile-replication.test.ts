import { describe, expect, it } from "vitest";
import { createCookieRule, createHeaderRule, createProfile } from "../profile-factory";
import { mergeProfileInto } from "../profile-merge";
import { migrateProfile, migrateProfileDocument } from "../profile-migration";
import { createProfileDocument, type ProfileState } from "../profile-document";
import type { Profile } from "../profile-model";
import { reduceProfileCommand } from "../../../services/profile/reduce-profile-command";
import { isProfile } from "../profile-validation";

function profile(id: string, title: string) {
  return createProfile({ title, id, backgroundColor: "#2563eb" });
}

function documentOf(profiles: Profile[], selectedProfileId: string, isPaused = false) {
  return createProfileDocument(
    { profiles, selectedProfileId } satisfies ProfileState,
    "test",
    1,
    isPaused,
  );
}

describe("setGlobalPaused command", () => {
  const selected = profile("a", "A");

  it("flips the global pause flag", () => {
    const result = reduceProfileCommand(
      documentOf([selected], "a"),
      {
        type: "setGlobalPaused",
        paused: true,
      },
      "test",
    );

    expect(result.document.isPaused).toBe(true);
  });

  it("is a no-op when the flag already has that value", () => {
    const result = reduceProfileCommand(
      documentOf([selected], "a", true),
      {
        type: "setGlobalPaused",
        paused: true,
      },
      "test",
    );

    expect(result.status).toBe("noop");
  });

  it("leaves per-profile pause untouched", () => {
    const result = reduceProfileCommand(
      documentOf([selected], "a"),
      {
        type: "setGlobalPaused",
        paused: true,
      },
      "test",
    );

    expect(result.document.state.profiles[0].paused).toBe(false);
  });
});

describe("alwaysOn metadata patch", () => {
  it("is accepted through the standard metadata patch", () => {
    const target = profile("a", "A");
    const result = reduceProfileCommand(
      documentOf([target], "a"),
      {
        type: "patchProfile",
        profileId: "a",
        patch: { alwaysOn: true },
      },
      "test",
    );

    expect(result.document.state.profiles[0].alwaysOn).toBe(true);
  });
});

describe("sortProfilesByTitle command", () => {
  it("orders profiles by title", () => {
    const document = documentOf([profile("a", "Zebra"), profile("b", "Alpha")], "a");
    const result = reduceProfileCommand(document, { type: "sortProfilesByTitle" }, "test");

    expect(result.document.state.profiles.map((p) => p.title)).toEqual(["Alpha", "Zebra"]);
  });

  it("keeps the selection pointing at the same profile", () => {
    const document = documentOf([profile("a", "Zebra"), profile("b", "Alpha")], "a");
    const result = reduceProfileCommand(document, { type: "sortProfilesByTitle" }, "test");

    expect(result.document.state.selectedProfileId).toBe("a");
  });

  it("is a no-op when already sorted", () => {
    const document = documentOf([profile("a", "Alpha"), profile("b", "Beta")], "a");
    const result = reduceProfileCommand(document, { type: "sortProfilesByTitle" }, "test");

    expect(result.status).toBe("noop");
  });
});

describe("mergeProfile", () => {
  function withHeaders(id: string, title: string, names: string[]) {
    const base = profile(id, title);
    return {
      ...base,
      rules: {
        ...base.rules,
        requestHeaders: names.map((name) => createHeaderRule({ name, value: "1" })),
      },
    };
  }

  it("adds rules that the target does not have", () => {
    const target = withHeaders("a", "A", ["x-one"]);
    const source = withHeaders("b", "B", ["x-two"]);

    const merged = mergeProfileInto(target, source);
    expect(merged.rules.requestHeaders.map((rule) => rule.name)).toEqual(["x-one", "x-two"]);
  });

  it("skips rules that would have the same effect", () => {
    const target = withHeaders("a", "A", ["x-one", "x-two"]);
    const source = withHeaders("b", "B", ["x-two"]);

    const merged = mergeProfileInto(target, source);
    expect(merged.rules.requestHeaders.map((rule) => rule.name)).toEqual(["x-one", "x-two"]);
  });

  it("gives merged rules fresh ids", () => {
    const target = withHeaders("a", "A", ["x-one"]);
    const source = withHeaders("b", "B", ["x-two"]);

    const merged = mergeProfileInto(target, source);
    const ids = merged.rules.requestHeaders.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns the same object when there is nothing to add", () => {
    const target = withHeaders("a", "A", ["x-one"]);
    expect(mergeProfileInto(target, withHeaders("b", "B", ["x-one"]))).toBe(target);
  });

  it("keeps the target's own title and colour", () => {
    const target = withHeaders("a", "A", ["x-one"]);
    const source = withHeaders("b", "B", ["x-two"]);

    const merged = mergeProfileInto(target, source);
    expect(merged.title).toBe("A");
    expect(merged.backgroundColor).toBe("#2563eb");
    expect(merged.enabled).toBe(true);
  });

  it("merges through the reducer and stays a valid profile", () => {
    const target = withHeaders("a", "A", ["x-one"]);
    const source = withHeaders("b", "B", ["x-two"]);

    const result = reduceProfileCommand(
      documentOf([target], "a"),
      {
        type: "mergeProfile",
        targetProfileId: "a",
        source,
      },
      "test",
    );

    expect(result.status).toBe("applied");
    expect(result.document.state.profiles[0].rules.requestHeaders).toHaveLength(2);
    expect(isProfile(result.document.state.profiles[0])).toBe(true);
  });

  it("merges cookies and Set-Cookie rules too", () => {
    const target = profile("a", "A");
    const source = profile("b", "B");
    const withCookies = {
      ...source,
      rules: {
        ...source.rules,
        cookies: [createCookieRule({ name: "sid", value: "1" })],
        setCookies: [createCookieRule({ name: "theme", value: "dark" })],
      },
    };

    const merged = mergeProfileInto(target, withCookies);
    expect(merged.rules.cookies).toHaveLength(1);
    expect(merged.rules.setCookies).toHaveLength(1);
  });
});

describe("storage migration", () => {
  /** The shape written before `alwaysOn`, `setCookies` and `writeMode` existed. */
  function legacyProfile() {
    return {
      version: 1,
      id: "legacy-1",
      title: "Legacy",
      shortTitle: "L",
      backgroundColor: "#123456",
      textColor: "white",
      hideComment: true,
      enabled: true,
      paused: false,
      rules: {
        requestHeaders: [
          {
            id: "h1",
            enabled: true,
            name: "x-legacy",
            value: "1",
            comment: "",
            appendMode: "override",
            sendEmptyHeader: false,
          },
        ],
        responseHeaders: [],
        csp: [],
        cookies: [{ id: "c1", enabled: true, name: "sid", value: "abc", comment: "" }],
        redirects: [],
      },
      filters: [],
    };
  }

  it("fills alwaysOn, setCookies and writeMode on an older document", () => {
    const migrated = migrateProfile(legacyProfile());

    expect(migrated).not.toBeNull();
    expect(migrated!.alwaysOn).toBe(false);
    expect(migrated!.rules.setCookies).toEqual([]);
    expect(migrated!.rules.cookies[0].writeMode).toBe("set");
  });

  it("produces a document that passes strict validation", () => {
    const migrated = migrateProfile(legacyProfile());
    expect(isProfile(migrated)).toBe(true);
  });

  it("keeps every existing rule rather than dropping it", () => {
    const migrated = migrateProfile(legacyProfile());

    expect(migrated!.rules.requestHeaders).toHaveLength(1);
    expect(migrated!.rules.requestHeaders[0].name).toBe("x-legacy");
    expect(migrated!.rules.cookies).toHaveLength(1);
  });

  it("resolves a stored comma mode to a loadable profile", () => {
    const legacy = legacyProfile();
    legacy.rules.requestHeaders[0].appendMode = "comma";

    const migrated = migrateProfile(legacy);
    expect(migrated).not.toBeNull();
    expect(isProfile(migrated)).toBe(true);
  });

  it("migrates a whole stored envelope", () => {
    const migrated = migrateProfileDocument({
      state: { profiles: [legacyProfile()], selectedProfileId: "legacy-1", isPaused: true },
      revision: 7,
      sourceId: "src",
    });

    expect(migrated).not.toBeNull();
    expect(migrated!.revision).toBe(7);
    expect(migrated!.isPaused).toBe(true);
    expect(migrated!.state.selectedProfileId).toBe("legacy-1");
  });

  it("repairs a selection that points at a missing profile", () => {
    const migrated = migrateProfileDocument({
      state: { profiles: [legacyProfile()], selectedProfileId: "gone", isPaused: false },
      revision: 1,
      sourceId: "",
    });

    expect(migrated!.state.selectedProfileId).toBe("legacy-1");
  });

  it("returns null for a payload that cannot be recovered", () => {
    expect(migrateProfileDocument({ state: { profiles: "nope" } })).toBeNull();
  });
});
