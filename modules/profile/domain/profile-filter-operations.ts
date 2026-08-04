import { arrayMoveImmutable } from "array-move";
import {
  createProfileFilter,
  isFilterKind,
  isFilterMode,
  isFilterValue,
  isProfileFilter,
  orderedProfileFilters,
} from "./profile-filter";
import type { Profile, ProfileFilter } from "./profile-model";
import { profileHasEntityId } from "./profile-operations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyFilterPatch(
  filter: ProfileFilter,
  expectedKind: unknown,
  patch: unknown,
): ProfileFilter {
  if (!isFilterKind(expectedKind) || !isRecord(patch)) return filter;
  const sanitized: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") sanitized.enabled = patch.enabled;
  if (isFilterMode(patch.mode)) sanitized.mode = patch.mode;
  if (expectedKind === filter.kind && isFilterValue(filter.kind, patch.value)) {
    sanitized.value = patch.value;
  }
  if (typeof patch.comment === "string") sanitized.comment = patch.comment;
  if (Object.keys(sanitized).length === 0) return filter;
  const candidate = { ...filter, ...sanitized, id: filter.id, kind: filter.kind };
  if (!isProfileFilter(candidate)) return filter;
  return Object.entries(sanitized).every(
    ([key, value]) => filter[key as keyof ProfileFilter] === value,
  )
    ? filter
    : candidate;
}

export function addProfileFilter(profile: Profile, filter: unknown): Profile {
  if (!isProfileFilter(filter) || profileHasEntityId(profile, filter.id)) return profile;
  return {
    ...profile,
    filters: {
      byId: { ...profile.filters.byId, [filter.id]: filter },
      order: [...profile.filters.order, filter.id],
    },
  };
}

export function patchProfileFilter(
  profile: Profile,
  filterId: string,
  expectedKind: unknown,
  patch: unknown,
): Profile {
  if (!Object.hasOwn(profile.filters.byId, filterId)) return profile;
  const filter = profile.filters.byId[filterId];
  const nextFilter = applyFilterPatch(filter, expectedKind, patch);
  if (nextFilter === filter) return profile;
  return {
    ...profile,
    filters: {
      ...profile.filters,
      byId: { ...profile.filters.byId, [filterId]: nextFilter },
    },
  };
}

export function changeProfileFilterKind(
  profile: Profile,
  filterId: string,
  kind: unknown,
  currentTabId?: number,
): Profile {
  if (!Object.hasOwn(profile.filters.byId, filterId)) return profile;
  const filter = profile.filters.byId[filterId];
  if (!isFilterKind(kind) || kind === filter.kind) return profile;
  const nextFilter = {
    ...createProfileFilter({ id: filterId, kind, mode: filter.mode, currentTabId }),
    enabled: filter.enabled,
    comment: filter.comment,
  };
  return {
    ...profile,
    filters: {
      ...profile.filters,
      byId: { ...profile.filters.byId, [filterId]: nextFilter },
    },
  };
}

export function deleteProfileFilter(profile: Profile, filterId: string): Profile {
  if (!Object.hasOwn(profile.filters.byId, filterId)) return profile;
  const byId = { ...profile.filters.byId };
  delete byId[filterId];
  return {
    ...profile,
    filters: {
      byId,
      order: profile.filters.order.filter((id) => id !== filterId),
    },
  };
}

export function reorderProfileFilters(
  profile: Profile,
  sourceFilterId: string,
  targetFilterId: string,
): Profile {
  const sourceIndex = profile.filters.order.indexOf(sourceFilterId);
  const targetIndex = profile.filters.order.indexOf(targetFilterId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return profile;
  return {
    ...profile,
    filters: {
      ...profile.filters,
      order: arrayMoveImmutable(profile.filters.order, sourceIndex, targetIndex),
    },
  };
}

export function setProfileFiltersEnabled(profile: Profile, enabled: unknown): Profile {
  if (typeof enabled !== "boolean") return profile;
  let changed = false;
  const byId = { ...profile.filters.byId };
  for (const filterId of profile.filters.order) {
    const filter = byId[filterId];
    if (!filter || filter.enabled === enabled) continue;
    byId[filterId] = { ...filter, enabled };
    changed = true;
  }
  return changed ? { ...profile, filters: { ...profile.filters, byId } } : profile;
}

export function clearProfileFilters(profile: Profile): Profile {
  if (profile.filters.order.length === 0) return profile;
  return { ...profile, filters: { byId: {}, order: [] } };
}

function filterSortGroup(filter: ProfileFilter): number {
  if (filter.kind === "urlPattern" || filter.kind === "urlRegex") {
    return filter.mode === "include" ? 0 : 1;
  }
  if (filter.kind === "initiator") return 2;
  if (filter.kind === "resourceType") return 3;
  if (filter.kind === "tab") return 4;
  return 5;
}

export function sortProfileFilters(profile: Profile): Profile {
  const sorted = [...orderedProfileFilters(profile)].sort(
    (left, right) =>
      filterSortGroup(left) - filterSortGroup(right) ||
      String(left.value).localeCompare(String(right.value)),
  );
  const order = sorted.map((filter) => filter.id);
  if (order.every((filterId, index) => profile.filters.order[index] === filterId)) {
    return profile;
  }
  return { ...profile, filters: { ...profile.filters, order } };
}
