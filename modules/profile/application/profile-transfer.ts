import { hasExactKeys, isArrayOf, isRecord } from "../domain/profile-guards";
import {
  fromPersistedProfile,
  isPersistedProfile,
  toPersistedProfile,
} from "../domain/profile-persistence";
import type { PersistedProfile, Profile } from "../domain/profile-model";

export const PROFILE_EXPORT_SCHEMA_VERSION = 2 as const;

export interface ProfileExportDocument {
  schemaVersion: typeof PROFILE_EXPORT_SCHEMA_VERSION;
  profiles: PersistedProfile[];
}

export function createProfileExportDocument(profiles: Profile[]): ProfileExportDocument {
  return {
    schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION,
    profiles: profiles.map(toPersistedProfile),
  };
}

export function parseProfileExportDocument(value: unknown): Profile[] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "profiles"]) ||
    value.schemaVersion !== PROFILE_EXPORT_SCHEMA_VERSION ||
    !isArrayOf(value.profiles, isPersistedProfile)
  ) {
    return null;
  }
  return value.profiles.map(fromPersistedProfile);
}
