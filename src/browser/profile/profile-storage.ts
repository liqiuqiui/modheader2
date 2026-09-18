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

export async function readStoredProfileDocument(): Promise<ProfileDocument> {
  const persisted = await profileStateStorage.getValue();
  if (!isPersistedProfileDocument(persisted)) {
    throw new Error("Invalid profile storage document");
  }
  const state = fromPersistedState(persisted.state);
  return {
    schemaVersion: createEmptyProfileDocument().schemaVersion,
    revision: persisted.revision,
    sourceId: persisted.sourceId,
    isPaused: state.isPaused,
    state: { profiles: state.profiles, selectedProfileId: state.selectedProfileId },
  };
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
