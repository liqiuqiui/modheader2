import {
  createProfileDocument,
  type ProfileDocument,
  type ProfileState,
} from "../types/profile/profile-document";

export interface ProfileDataState extends ProfileState {
  revision: number;
  sourceId: string;
  isPaused: boolean;
}

export const initialProfileDataState: ProfileDataState = {
  profiles: [],
  selectedProfileId: null,
  revision: 0,
  sourceId: "",
  isPaused: false,
};

export interface ProfileHistoryState {
  past: ProfileState[];
  future: ProfileState[];
}

export const initialProfileHistoryState: ProfileHistoryState = {
  past: [],
  future: [],
};

export type ProfileSyncStatus = "idle" | "loading" | "ready" | "error";

export interface ProfileSyncState {
  status: ProfileSyncStatus;
  error: string | null;
}

export const initialProfileSyncState: ProfileSyncState = {
  status: "idle",
  error: null,
};

export function profileDataFromDocument(document: ProfileDocument): ProfileDataState {
  return {
    profiles: document.state.profiles,
    selectedProfileId: document.state.selectedProfileId,
    revision: document.revision,
    sourceId: document.sourceId,
    isPaused: document.isPaused,
  };
}

export function pushProfileHistory(
  current: ProfileState,
  history: ProfileHistoryState,
  limit: number,
): ProfileHistoryState {
  return {
    past: [...history.past, current].slice(-limit),
    future: [],
  };
}

export function profileStateOf(state: ProfileState): ProfileState {
  return {
    profiles: state.profiles,
    selectedProfileId: state.selectedProfileId,
  };
}

export function documentOf(state: ProfileDataState): ProfileDocument {
  return createProfileDocument(
    profileStateOf(state),
    state.sourceId,
    state.revision,
    state.isPaused,
  );
}
