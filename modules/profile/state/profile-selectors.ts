import { orderedProfileFilters } from "../domain/profile-filter";
import type { Profile, ProfileFilter } from "../domain/profile-model";
import type { ProfileStoreState } from "./profile-store";

export function selectSelectedProfile(state: ProfileStoreState): Profile | undefined {
  return state.selectedProfileId ? state.profilesById[state.selectedProfileId] : undefined;
}

export function selectOrderedProfiles(state: ProfileStoreState): Profile[] {
  return state.profileOrder.flatMap((profileId) => {
    const profile = state.profilesById[profileId];
    return profile ? [profile] : [];
  });
}

export function selectSelectedProfileFilters(state: ProfileStoreState): ProfileFilter[] {
  const profile = selectSelectedProfile(state);
  return profile ? orderedProfileFilters(profile) : [];
}

export function selectCanUndo(state: ProfileStoreState): boolean {
  return state.past.length > 0;
}

export function selectCanRedo(state: ProfileStoreState): boolean {
  return state.future.length > 0;
}
