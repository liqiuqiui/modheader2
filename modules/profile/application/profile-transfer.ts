import { PROFILE_DOCUMENT_SCHEMA_VERSION } from "../domain/profile-document";
import { isArrayOf, isRecord } from "../domain/profile-guards";
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
  if (!isRecord(value)) {
    return null;
  }
  const document = value as Record<string, unknown>;
  if (document.schemaVersion !== PROFILE_DOCUMENT_SCHEMA_VERSION) return null;
  const profiles = document.profiles;
  return isArrayOf(profiles, isProfile) ? profiles : null;
}
