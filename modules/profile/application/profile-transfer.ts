import { PROFILE_DOCUMENT_SCHEMA_VERSION } from "../domain/profile-document";
import type { Profile } from "../domain/profile-model";
import { isProfile } from "../domain/profile-validation";

export interface ProfileExportDocument {
  schemaVersion: typeof PROFILE_DOCUMENT_SCHEMA_VERSION;
  profiles: Profile[];
}

export function createProfileExportDocument(profiles: Profile[]): ProfileExportDocument {
  return { schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION, profiles };
}

export function parseProfileExportDocument(value: unknown): Profile[] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Record<string, unknown>).schemaVersion !== PROFILE_DOCUMENT_SCHEMA_VERSION
  ) {
    return null;
  }
  const profiles = (value as Record<string, unknown>).profiles;
  return Array.isArray(profiles) && profiles.every(isProfile) ? profiles : null;
}
