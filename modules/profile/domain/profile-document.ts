import type { Profile } from "./profile-model";

export const PROFILE_DOCUMENT_SCHEMA_VERSION = 1 as const;

export interface ProfileState {
  profiles: Profile[];
  selectedProfileId: string | null;
}

export interface ProfileDocument {
  schemaVersion: typeof PROFILE_DOCUMENT_SCHEMA_VERSION;
  revision: number;
  sourceId: string;
  state: ProfileState;
}

export function createProfileDocument(
  state: ProfileState,
  sourceId: string,
  revision: number,
): ProfileDocument {
  return {
    schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION,
    revision,
    sourceId,
    state,
  };
}

export function createEmptyProfileDocument(): ProfileDocument {
  return createProfileDocument({ profiles: [], selectedProfileId: null }, "", 0);
}

export function createInitialProfileDocument(
  profile: Profile,
  sourceId: string,
  revision: number,
): ProfileDocument {
  return createProfileDocument(
    {
      profiles: [profile],
      selectedProfileId: profile.id,
    },
    sourceId,
    revision,
  );
}

export function withPreferredProfileSelection(
  state: ProfileState,
  preferredProfileId: string | null,
): ProfileState {
  if (
    !preferredProfileId ||
    !state.profiles.some((profile) => profile.id === preferredProfileId) ||
    state.selectedProfileId === preferredProfileId
  ) {
    return state;
  }
  return { ...state, selectedProfileId: preferredProfileId };
}
