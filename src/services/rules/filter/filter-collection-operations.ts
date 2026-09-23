import { moveEntityById } from "../../../types/profile/profile-collections";
import {
  createProfileFilter,
  isFilterKind,
  isFilterMode,
  isFilterValue,
  isProfileFilter,
  type FilterTarget,
} from "../../../types/profile/profile-filter";
import { isRecord } from "../../../types/profile/profile-guards";
import type { Profile, ProfileFilter } from "../../../types/profile/profile-model";
import { profileHasEntityId } from "../../../types/profile/profile-operations";

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

  if (
    Object.keys(sanitized).length === 0 ||
    Object.entries(sanitized).every(([key, value]) =>
      Object.is(filter[key as keyof ProfileFilter], value),
    )
  ) {
    return filter;
  }

  const candidate = { ...filter, ...sanitized, id: filter.id, kind: filter.kind };
  return isProfileFilter(candidate) ? candidate : filter;
}

export function addProfileFilter(profile: Profile, filter: unknown): Profile {
  if (!isProfileFilter(filter) || profileHasEntityId(profile, filter.id)) return profile;
  return { ...profile, filters: [...profile.filters, filter] };
}

export function patchProfileFilter(
  profile: Profile,
  filterId: string,
  expectedKind: unknown,
  patch: unknown,
): Profile {
  const index = profile.filters.findIndex((filter) => filter.id === filterId);
  if (index < 0) return profile;
  const filter = profile.filters[index];
  const nextFilter = applyFilterPatch(filter, expectedKind, patch);
  if (nextFilter === filter) return profile;
  const filters = [...profile.filters];
  filters[index] = nextFilter;
  return { ...profile, filters };
}

export function changeProfileFilterKind(
  profile: Profile,
  filterId: string,
  kind: unknown,
  target: FilterTarget = {},
): Profile {
  const index = profile.filters.findIndex((filter) => filter.id === filterId);
  if (index < 0) return profile;
  const filter = profile.filters[index];
  if (!isFilterKind(kind) || kind === filter.kind) return profile;

  const nextFilter = {
    ...createProfileFilter({ id: filterId, kind, mode: filter.mode, ...target }),
    enabled: filter.enabled,
    comment: filter.comment,
  };
  const filters = [...profile.filters];
  filters[index] = nextFilter;
  return { ...profile, filters };
}

export function deleteProfileFilter(profile: Profile, filterId: string): Profile {
  const filters = profile.filters.filter((filter) => filter.id !== filterId);
  return filters.length === profile.filters.length ? profile : { ...profile, filters };
}

export function reorderProfileFilters(
  profile: Profile,
  sourceFilterId: string,
  targetFilterId: string,
): Profile {
  const filters = moveEntityById(profile.filters, sourceFilterId, targetFilterId);
  return filters === profile.filters ? profile : { ...profile, filters };
}

export function setProfileFiltersEnabled(profile: Profile, enabled: unknown): Profile {
  if (
    typeof enabled !== "boolean" ||
    profile.filters.every((filter) => filter.enabled === enabled)
  ) {
    return profile;
  }
  return {
    ...profile,
    filters: profile.filters.map((filter) =>
      filter.enabled === enabled ? filter : { ...filter, enabled },
    ),
  };
}

export function clearProfileFilters(profile: Profile): Profile {
  return profile.filters.length === 0 ? profile : { ...profile, filters: [] };
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
  const filters = [...profile.filters].sort(
    (left, right) =>
      filterSortGroup(left) - filterSortGroup(right) ||
      String(left.value).localeCompare(String(right.value)),
  );
  const unchanged = filters.every((filter, index) => profile.filters[index]?.id === filter.id);
  return unchanged ? profile : { ...profile, filters };
}
