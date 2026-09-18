import type { PersistedProfile, PersistedProfileState, Profile } from "./profile-model";
import { hasExactKeys, isArrayOf, isRecord } from "./profile-guards";
import { isProfile } from "./profile-validation";

export function toPersistedProfile(profile: Profile): PersistedProfile {
  return structuredClone(profile);
}

export function toPersistedState(
  profiles: Profile[],
  selectedProfileId: string | null,
  isPaused: boolean,
): PersistedProfileState {
  return {
    profiles: structuredClone(profiles),
    selectedProfileId,
    isPaused,
  };
}

export function fromPersistedProfile(value: PersistedProfile): Profile {
  return structuredClone(value);
}

export function fromPersistedState(value: PersistedProfileState): {
  profiles: Profile[];
  selectedProfileId: string | null;
  isPaused: boolean;
} {
  return {
    profiles: value.profiles.map(fromPersistedProfile),
    selectedProfileId: value.selectedProfileId,
    isPaused: value.isPaused,
  };
}

export function isPersistedProfileState(value: unknown): value is PersistedProfileState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["profiles", "selectedProfileId", "isPaused"]) ||
    !isArrayOf(value.profiles, isProfile) ||
    (value.selectedProfileId !== null && typeof value.selectedProfileId !== "string") ||
    typeof value.isPaused !== "boolean"
  ) {
    return false;
  }

  const profileIds = value.profiles.map((profile) => profile.id);
  if (new Set(profileIds).size !== profileIds.length) return false;
  if (value.profiles.length === 0) return value.selectedProfileId === null;
  return value.selectedProfileId !== null && profileIds.includes(value.selectedProfileId);
}

export function isPersistedProfile(value: unknown): value is PersistedProfile {
  return isProfile(value);
}
