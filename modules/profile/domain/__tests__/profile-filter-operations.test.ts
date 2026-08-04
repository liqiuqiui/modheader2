import { describe, expect, it } from "vitest";
import {
  addProfileFilter,
  changeProfileFilterKind,
  clearProfileFilters,
  deleteProfileFilter,
  patchProfileFilter,
  reorderProfileFilters,
  setProfileFiltersEnabled,
  sortProfileFilters,
} from "../profile-filter-operations";
import { createProfile } from "../profile-factory";
import { createProfileFilter, orderedProfileFilters } from "../profile-filter";
import type { Profile } from "../profile-model";

function emptyProfile(): Profile {
  return {
    ...createProfile({ title: "Test", id: "profile-1", backgroundColor: "#2563eb" }),
    headers: [],
  };
}

describe("normalized Profile filter operations", () => {
  it("adds, patches and deletes both the entity and its order entry", () => {
    const filter = createProfileFilter({
      id: "filter-1",
      kind: "urlPattern",
      mode: "include",
    });
    const added = addProfileFilter(emptyProfile(), filter);
    const patched = patchProfileFilter(added, filter.id, filter.kind, {
      enabled: false,
      value: "*://example.com/*",
      id: "ignored",
      kind: "method",
    });

    expect(added.filters.order).toEqual([filter.id]);
    expect(patched.filters.byId[filter.id]).toMatchObject({
      id: filter.id,
      kind: "urlPattern",
      enabled: false,
      value: "*://example.com/*",
    });
    expect(deleteProfileFilter(patched, filter.id).filters).toEqual({ byId: {}, order: [] });
  });

  it("preserves metadata and order while changing kind", () => {
    const original = {
      ...createProfileFilter({
        id: "filter-1",
        kind: "urlRegex",
        mode: "exclude",
      }),
      enabled: false,
      comment: "keep me",
      value: "example\\.com",
    };
    const profile = addProfileFilter(emptyProfile(), original);
    const changed = changeProfileFilterKind(profile, original.id, "tab", 42);

    expect(changed.filters.order).toEqual([original.id]);
    expect(changed.filters.byId[original.id]).toEqual({
      id: original.id,
      kind: "tab",
      mode: "exclude",
      enabled: false,
      comment: "keep me",
      value: 42,
    });
  });

  it("treats invalid patches and true no-ops as reference-stable", () => {
    const filter = createProfileFilter({ id: "filter-1", kind: "tab" });
    const profile = addProfileFilter(emptyProfile(), filter);

    expect(patchProfileFilter(profile, filter.id, filter.kind, { value: -1 })).toBe(profile);
    expect(patchProfileFilter(profile, "missing", filter.kind, { enabled: false })).toBe(profile);
    expect(addProfileFilter(profile, filter)).toBe(profile);
    expect(setProfileFiltersEnabled(profile, true)).toBe(profile);
    expect(reorderProfileFilters(profile, filter.id, filter.id)).toBe(profile);
  });

  it("reorders and sorts order without rebuilding filter entities", () => {
    const method = createProfileFilter({ id: "method", kind: "method" });
    const url = {
      ...createProfileFilter({ id: "url", kind: "urlPattern" }),
      value: "*://example.com/*",
    };
    const initiator = {
      ...createProfileFilter({ id: "initiator", kind: "initiator" }),
      value: "example.com",
    };
    const profile = [method, url, initiator].reduce(addProfileFilter, emptyProfile());
    const reordered = reorderProfileFilters(profile, method.id, initiator.id);
    const sorted = sortProfileFilters(reordered);

    expect(reordered.filters.order).toEqual([url.id, initiator.id, method.id]);
    expect(sorted.filters.order).toEqual([url.id, initiator.id, method.id]);
    expect(sorted.filters.byId).toBe(reordered.filters.byId);
    expect(orderedProfileFilters(sorted).map((filter) => filter.id)).toEqual(sorted.filters.order);
  });

  it("does not reinterpret a stale value patch after the filter kind changes", () => {
    const filter = {
      ...createProfileFilter({ id: "filter-1", kind: "urlPattern" }),
      value: "*://before/*",
    };
    const profile = addProfileFilter(emptyProfile(), filter);
    const changed = changeProfileFilterKind(profile, filter.id, "initiator");
    const stalePatch = patchProfileFilter(changed, filter.id, "urlPattern", {
      value: "*://stale/*",
      comment: "comment still applies",
    });

    expect(stalePatch.filters.byId[filter.id]).toMatchObject({
      kind: "initiator",
      value: "",
      comment: "comment still applies",
    });
  });

  it("clears the normalized collection atomically", () => {
    const filter = createProfileFilter({ id: "filter-1", kind: "method" });
    const profile = addProfileFilter(emptyProfile(), filter);

    expect(clearProfileFilters(profile).filters).toEqual({ byId: {}, order: [] });
  });
});
