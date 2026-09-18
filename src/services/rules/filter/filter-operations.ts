import type {
  FilterKind,
  ProfileFilter,
  ProfileFilterPatch,
} from "../../../types/profile/profile-model";
import { createFilter } from "./filter-parser";

export function patchFilter(
  filter: ProfileFilter,
  expectedKind: FilterKind,
  patch: ProfileFilterPatch,
): ProfileFilter {
  if (filter.kind !== expectedKind) return filter;
  return { ...filter, ...patch, id: filter.id, kind: filter.kind } as ProfileFilter;
}

export function changeFilterKind(
  filter: ProfileFilter,
  kind: FilterKind,
  currentTabId?: number,
): ProfileFilter {
  const next = createFilter({ kind, currentTabId, id: filter.id, mode: filter.mode });
  return { ...next, enabled: filter.enabled, comment: filter.comment } as ProfileFilter;
}
