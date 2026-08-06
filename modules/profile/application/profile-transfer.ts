import { hasExactKeys, isArrayOf, isRecord } from "../domain/profile-guards";
import type { Profile } from "../domain/profile-model";
import { isProfile } from "../domain/profile-validation";

export const PROFILE_EXPORT_SCHEMA_VERSION = 1 as const;

export interface ProfileExportDocument {
  schemaVersion: typeof PROFILE_EXPORT_SCHEMA_VERSION;
  profiles: Profile[];
}

export function createProfileExportDocument(profiles: Profile[]): ProfileExportDocument {
  return { schemaVersion: PROFILE_EXPORT_SCHEMA_VERSION, profiles };
}

export function parseProfileExportDocument(value: unknown): Profile[] | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "profiles"]) ||
    value.schemaVersion !== PROFILE_EXPORT_SCHEMA_VERSION
  ) {
    return null;
  }
  return isArrayOf(value.profiles, isProfile) ? value.profiles : null;
}
