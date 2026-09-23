import {
  createProfileFilter,
  isFilterKind,
  isFilterMode,
  isFilterValue,
  type FilterTarget,
} from "../../../types/profile/profile-filter";
import type {
  FilterKind,
  FilterMode,
  ProfileFilter,
  ProfileFilterByKind,
} from "../../../types/profile/profile-model";

// The guards live in `types/profile/profile-filter` — the module the reducers
// validate against. They are only re-exported here so this module keeps its
// public surface without a second copy that can drift from the original.
export {
  isFilterKind,
  isFilterMode,
  isRequestMethod,
  isResourceType,
  isFilterValue,
} from "../../../types/profile/profile-filter";

export function parseFilter(input: unknown): ProfileFilter | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<ProfileFilter>;
  if (
    typeof value.id !== "string" ||
    typeof value.enabled !== "boolean" ||
    !isFilterKind(value.kind) ||
    !isFilterMode(value.mode) ||
    typeof value.comment !== "string" ||
    !isFilterValue(value.kind, value.value)
  ) {
    return null;
  }
  return {
    ...value,
    id: value.id,
    kind: value.kind,
    mode: value.mode,
    value: value.value,
    comment: value.comment.trim(),
  } as ProfileFilter;
}

// The default value for a new filter lives in `createProfileFilter` so the UI
// preview and the reducer (which re-creates the filter on a kind change) can
// never disagree about what "current tab" means for each kind.
export function createFilter<K extends FilterKind>(
  options: { kind: K; mode?: FilterMode; id?: string } & FilterTarget,
): ProfileFilterByKind<K> {
  return createProfileFilter(options);
}
