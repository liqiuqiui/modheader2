import { createProfileFilter, type FilterTarget } from "../../../types/profile/profile-filter";
import type {
  FilterKind,
  FilterMode,
  ProfileFilterByKind,
} from "../../../types/profile/profile-model";

// The default value for a new filter lives in `createProfileFilter` so the UI
// preview and the reducer (which re-creates the filter on a kind change) can
// never disagree about what "current tab" means for each kind.
export function createFilter<K extends FilterKind>(
  options: { kind: K; mode?: FilterMode; id?: string } & FilterTarget,
): ProfileFilterByKind<K> {
  return createProfileFilter(options);
}
