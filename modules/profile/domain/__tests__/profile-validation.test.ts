import { describe, expect, it } from "vitest";
import {
  createEmptyProfileDocument,
  createInitialProfileDocument,
  withPreferredProfileSelection,
} from "../profile-document";
import { createProfile } from "../profile-factory";
import { createProfileFilter } from "../profile-filter";
import type { Profile } from "../profile-model";
import { isProfile, isProfileDocument } from "../profile-validation";

function emptyProfile(id = "profile-1"): Profile {
  return {
    ...createProfile({ title: "Test", id, backgroundColor: "#2563eb" }),
    headers: [],
  };
}

describe("Profile schema v2 validation", () => {
  it("accepts the normalized filter model", () => {
    const filter = createProfileFilter({
      id: "filter-1",
      kind: "urlPattern",
      mode: "include",
    });
    const profile = emptyProfile();
    profile.filters = { byId: { [filter.id]: filter }, order: [filter.id] };

    expect(isProfile(profile)).toBe(true);
    expect(isProfileDocument(createInitialProfileDocument(profile, "test", 1))).toBe(true);
  });

  it("accepts only the supported optional CSP rule mode", () => {
    const profile = emptyProfile();
    profile.respHeaders = [
      {
        id: "csp-1",
        enabled: true,
        name: "Content-Security-Policy",
        value: "default-src\t'self'",
        comment: "",
        appendMode: "override",
        sendEmptyHeader: false,
        cspMode: "directive",
      },
    ];

    expect(isProfile(profile)).toBe(true);
    expect(
      isProfile({
        ...profile,
        respHeaders: [{ ...profile.respHeaders[0], cspMode: "unsupported" }],
      }),
    ).toBe(false);
  });

  it("rejects the legacy categorized filter shape", () => {
    const profile = emptyProfile() as unknown as Record<string, unknown>;
    delete profile.filters;
    profile.filterOrder = [];
    profile.urlFilters = [];
    profile.excludeUrlFilters = [];
    profile.initiatorDomainFilters = [];
    profile.resourceFilters = [];
    profile.tabFilters = [];
    profile.methodFilters = [];
    profile.timeFilters = [];

    expect(isProfile(profile)).toBe(false);
  });

  it("requires filters.byId and filters.order to be a strict bijection", () => {
    const filter = createProfileFilter({ id: "filter-1", kind: "method" });
    const base = emptyProfile();

    expect(isProfile({ ...base, filters: { byId: { [filter.id]: filter }, order: [] } })).toBe(
      false,
    );
    expect(isProfile({ ...base, filters: { byId: {}, order: [filter.id] } })).toBe(false);
    expect(
      isProfile({
        ...base,
        filters: { byId: { alias: filter }, order: ["alias"] },
      }),
    ).toBe(false);
    expect(
      isProfile({
        ...base,
        filters: { byId: { [filter.id]: filter }, order: [filter.id, filter.id] },
      }),
    ).toBe(false);
  });

  it("rejects entity ID collisions inside a profile", () => {
    const profile = emptyProfile();
    const filter = createProfileFilter({ id: "shared-id", kind: "method" });
    profile.headers = [
      {
        id: "shared-id",
        enabled: true,
        name: "x-test",
        value: "1",
        comment: "",
        appendMode: "override",
        sendEmptyHeader: false,
      },
    ];
    profile.filters = { byId: { [filter.id]: filter }, order: [filter.id] };

    expect(isProfile(profile)).toBe(false);
  });

  it("requires profileOrder to reference every profilesById entry exactly once", () => {
    const first = emptyProfile("profile-1");
    const second = emptyProfile("profile-2");
    const document = {
      ...createEmptyProfileDocument(),
      revision: 1,
      sourceId: "test",
      profilesById: { [first.id]: first, [second.id]: second },
      profileOrder: [first.id, "missing-profile"],
      selectedProfileId: first.id,
    };

    expect(isProfileDocument(document)).toBe(false);
  });

  it("rejects invalid persisted tab IDs", () => {
    const profile = emptyProfile();
    const filter = {
      ...createProfileFilter({ id: "tab-filter", kind: "tab" }),
      value: -1,
    };
    profile.filters = { byId: { [filter.id]: filter }, order: [filter.id] };

    expect(isProfile(profile)).toBe(false);
  });

  it("preserves the active profile across history targets when it still exists", () => {
    const first = emptyProfile("profile-1");
    const second = emptyProfile("profile-2");
    const snapshot = {
      profilesById: { [first.id]: first, [second.id]: second },
      profileOrder: [first.id, second.id],
      selectedProfileId: first.id,
    };

    expect(withPreferredProfileSelection(snapshot, second.id).selectedProfileId).toBe(second.id);
    expect(withPreferredProfileSelection(snapshot, "missing")).toBe(snapshot);
  });
});
