import type { Profile } from "./profile-model";

export const PROFILE_DOCUMENT_SCHEMA_VERSION = 2 as const;

export interface ProfileDocument {
  schemaVersion: typeof PROFILE_DOCUMENT_SCHEMA_VERSION;
  revision: number;
  sourceId: string;
  profilesById: Record<string, Profile>;
  profileOrder: string[];
  selectedProfileId: string | null;
}

export interface ProfileSnapshot {
  profilesById: Record<string, Profile>;
  profileOrder: string[];
  selectedProfileId: string | null;
}

export function createEmptyProfileDocument(): ProfileDocument {
  return {
    schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION,
    revision: 0,
    sourceId: "",
    profilesById: {},
    profileOrder: [],
    selectedProfileId: null,
  };
}

export function createInitialProfileDocument(
  profile: Profile,
  sourceId: string,
  revision: number,
): ProfileDocument {
  return {
    schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION,
    revision,
    sourceId,
    profilesById: { [profile.id]: profile },
    profileOrder: [profile.id],
    selectedProfileId: profile.id,
  };
}

export function withPreferredProfileSelection(
  snapshot: ProfileSnapshot,
  preferredProfileId: string | null,
): ProfileSnapshot {
  if (
    !preferredProfileId ||
    !Object.hasOwn(snapshot.profilesById, preferredProfileId) ||
    snapshot.selectedProfileId === preferredProfileId
  ) {
    return snapshot;
  }
  return { ...snapshot, selectedProfileId: preferredProfileId };
}
