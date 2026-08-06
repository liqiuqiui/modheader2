import type { Profile } from "../domain/profile-model";
import type { ProfileStoreState } from "./profile-store";

export function selectSelectedProfile(state: ProfileStoreState): Profile | undefined {
  if (!state.selectedProfileId) return undefined;
  return state.profiles.find((profile) => profile.id === state.selectedProfileId);
}

export function selectOrderedProfiles(state: ProfileStoreState): Profile[] {
  return state.profiles;
}
