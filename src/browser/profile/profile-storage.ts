import { storage } from "wxt/utils/storage";
import {
  createEmptyProfileDocument,
  type ProfileDocument,
} from "../../types/profile/profile-document";
import {
  fromPersistedState,
  isPersistedProfileState,
  toPersistedState,
} from "../../types/profile/profile-persistence";
import { createProfileError } from "../../types/profile/profile-error";
import { migrateProfileDocument } from "../../types/profile/profile-migration";
import { isProfileDocument } from "../../types/profile/profile-validation";
import type { PersistedProfileState } from "../../types/profile/profile-model";

export type { ProfileDocument } from "../../types/profile/profile-document";

export const PROFILE_STATE_STORAGE_KEY = "local:profile-state" as const;

interface PersistedProfileDocument {
  state: PersistedProfileState;
  revision: number;
  sourceId: string;
}

const profileStateStorage = storage.defineItem<PersistedProfileDocument>(
  PROFILE_STATE_STORAGE_KEY,
  {
    defaultValue: {
      state: { profiles: [], selectedProfileId: null, isPaused: false },
      revision: 0,
      sourceId: "",
    },
  },
);

function isPersistedProfileDocument(value: unknown): value is PersistedProfileDocument {
  if (typeof value !== "object" || value === null) return false;
  if (!Object.keys(value).every((key) => ["state", "revision", "sourceId"].includes(key))) {
    return false;
  }
  const candidate = value as Partial<PersistedProfileDocument>;
  return (
    isPersistedProfileState(candidate.state) &&
    typeof candidate.revision === "number" &&
    Number.isInteger(candidate.revision) &&
    candidate.revision >= 0 &&
    typeof candidate.sourceId === "string"
  );
}

/**
 * A document written by an earlier version fails strict validation, so it is
 * migrated on read rather than rejected. The migrated shape is written straight
 * back so the upgrade only costs one extra write.
 */
async function readMigratedProfileDocument(): Promise<{
  document: ProfileDocument;
  migrated: boolean;
}> {
  const persisted = await profileStateStorage.getValue();
  if (isPersistedProfileDocument(persisted)) {
    const state = fromPersistedState(persisted.state);
    return {
      document: {
        schemaVersion: createEmptyProfileDocument().schemaVersion,
        revision: persisted.revision,
        sourceId: persisted.sourceId,
        isPaused: state.isPaused,
        state: { profiles: state.profiles, selectedProfileId: state.selectedProfileId },
      },
      migrated: false,
    };
  }

  const migrated = migrateProfileDocument(persisted);
  if (!migrated) {
    throw Object.assign(new Error("Invalid profile storage document"), {
      profileError: createProfileError("invalidStorageDocument"),
    });
  }
  await profileStateStorage.setValue({
    state: toPersistedState(
      migrated.state.profiles,
      migrated.state.selectedProfileId,
      migrated.isPaused,
    ),
    revision: migrated.revision,
    sourceId: migrated.sourceId,
  });
  return { document: migrated, migrated: true };
}

export async function readStoredProfileDocument(): Promise<ProfileDocument> {
  return (await readMigratedProfileDocument()).document;
}

export async function writeStoredProfileDocument(document: ProfileDocument): Promise<void> {
  if (!isProfileDocument(document)) {
    throw new Error("Refusing to persist an invalid profile document");
  }
  await profileStateStorage.setValue({
    state: toPersistedState(
      document.state.profiles,
      document.state.selectedProfileId,
      document.isPaused,
    ),
    revision: document.revision,
    sourceId: document.sourceId,
  });
}

export function watchStoredProfileDocument(
  callback: (document: ProfileDocument) => void,
): () => void {
  let generation = 0;
  const notify = () => {
    const currentGeneration = ++generation;
    void readStoredProfileDocument().then((document) => {
      if (currentGeneration === generation) callback(document);
    });
  };
  return profileStateStorage.watch(notify);
}
