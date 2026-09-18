import type { Profile } from "../types/profile/profile-model";
import type { AppStoreState } from "./app-store-contract";

export function selectSelectedProfile(state: AppStoreState): Profile | undefined {
  if (!state.selectedProfileId) return undefined;
  return state.profiles.find((profile) => profile.id === state.selectedProfileId);
}

export function selectOrderedProfiles(state: AppStoreState): Profile[] {
  return state.profiles;
}
