import { nanoid } from "nanoid";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Locale } from "../../../config/locales";
import i18n from "../../../i18n";
import type { ProfileCommand } from "../application/profile-command";
import { reduceProfileCommand } from "../application/reduce-profile-command";
import { randomProfileColor } from "../domain/profile-appearance";
import {
  createProfileDocument,
  type ProfileDocument,
  type ProfileState,
  withPreferredProfileSelection,
} from "../domain/profile-document";
import { createProfile } from "../domain/profile-factory";
import type {
  FilterKind,
  Profile,
  ProfileFilter,
  ProfileFilterPatch,
  ProfileMetadataPatch,
  ProfileRuleCollection,
  ProfileRuleCollectionMap,
  ProfileRulePatch,
} from "../domain/profile-model";
import {
  enqueueProfileCommand,
  PROFILE_COMMAND_CLIENT_ID,
} from "../infrastructure/profile-command-client";
import {
  readStoredProfileDocument,
  watchStoredProfileDocument,
} from "../infrastructure/profile-storage";

const HISTORY_LIMIT = 50;

export type ProfileStoreStatus = "idle" | "loading" | "ready" | "error";

export interface ProfileStoreState extends ProfileState {
  status: ProfileStoreStatus;
  revision: number;
  sourceId: string;
  error: string | null;
  past: ProfileState[];
  future: ProfileState[];
  initialize: (locale: Locale) => Promise<void>;
  selectProfile: (profileId: string) => Promise<boolean>;
  patchProfile: (profileId: string, patch: ProfileMetadataPatch) => Promise<boolean>;
  addRule: <K extends ProfileRuleCollection>(
    profileId: string,
    collection: K,
    rule: ProfileRuleCollectionMap[K],
  ) => Promise<boolean>;
  patchRule: <K extends ProfileRuleCollection>(
    profileId: string,
    collection: K,
    ruleId: string,
    patch: ProfileRulePatch<K>,
  ) => Promise<boolean>;
  deleteRule: (
    profileId: string,
    collection: ProfileRuleCollection,
    ruleId: string,
  ) => Promise<boolean>;
  cloneRule: (
    profileId: string,
    collection: ProfileRuleCollection,
    ruleId: string,
    cloneId: string,
  ) => Promise<boolean>;
  setRulesEnabled: (
    profileId: string,
    collection: ProfileRuleCollection,
    enabled: boolean,
  ) => Promise<boolean>;
  clearRules: (profileId: string, collection: ProfileRuleCollection) => Promise<boolean>;
  convertHeader: (
    profileId: string,
    ruleId: string,
    target: "requestHeaders" | "responseHeaders",
  ) => Promise<boolean>;
  addFilter: (profileId: string, filter: ProfileFilter) => Promise<boolean>;
  patchFilter: (
    profileId: string,
    filterId: string,
    expectedKind: FilterKind,
    patch: ProfileFilterPatch,
  ) => Promise<boolean>;
  changeFilterKind: (
    profileId: string,
    filterId: string,
    kind: FilterKind,
    currentTabId?: number,
  ) => Promise<boolean>;
  deleteFilter: (profileId: string, filterId: string) => Promise<boolean>;
  reorderFilters: (
    profileId: string,
    sourceFilterId: string,
    targetFilterId: string,
  ) => Promise<boolean>;
  setFiltersEnabled: (profileId: string, enabled: boolean) => Promise<boolean>;
  clearFilters: (profileId: string) => Promise<boolean>;
  reorderProfiles: (fromIndex: number, toIndex: number) => Promise<boolean>;
  addProfile: (locale: Locale) => Promise<boolean>;
  cloneProfile: (profileId: string, locale: Locale) => Promise<boolean>;
  deleteProfile: (profileId: string, locale: Locale) => Promise<boolean>;
  importProfiles: (profiles: Profile[]) => Promise<number>;
  sortProfileRules: (profileId: string) => Promise<boolean>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
}

let initializationPromise: Promise<void> | null = null;
let stopWatchingStorage: (() => void) | null = null;
let pendingCommands = 0;
let deferredDocument: ProfileDocument | null = null;
let authoritativeDocument: ProfileDocument | null = null;
let lastAuthoritativeRevision = 0;
let sawExternalChange = false;
let commandFailed = false;
let storageResetPending = false;
let storageResetGeneration = 0;
let currentLocale: Locale = "zh-CN";
let commandSettlementWaiters: Array<() => void> = [];

function waitForPendingCommands(): Promise<void> {
  if (pendingCommands === 0) return Promise.resolve();
  return new Promise((resolve) => commandSettlementWaiters.push(resolve));
}

function resolveCommandSettlementWaiters() {
  const waiters = commandSettlementWaiters;
  commandSettlementWaiters = [];
  for (const resolve of waiters) resolve();
}

function createLocalizedProfile(number: number, locale: Locale): Profile {
  const title = i18n.getFixedT(locale)("profile.defaultName", { number });
  return createProfile({ title });
}

function profileStateOf(state: ProfileState): ProfileState {
  return {
    profiles: state.profiles,
    selectedProfileId: state.selectedProfileId,
  };
}

function documentOf(state: ProfileStoreState): ProfileDocument {
  return createProfileDocument(profileStateOf(state), state.sourceId, state.revision);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rememberDeferredDocument(document: ProfileDocument) {
  if (!deferredDocument || document.revision >= deferredDocument.revision) {
    deferredDocument = document;
  }
}

function createAddRuleCommand<K extends ProfileRuleCollection>(
  profileId: string,
  collection: K,
  rule: ProfileRuleCollectionMap[K],
): ProfileCommand {
  return { type: "addRule", profileId, collection, rule } as ProfileCommand;
}

function createPatchRuleCommand<K extends ProfileRuleCollection>(
  profileId: string,
  collection: K,
  ruleId: string,
  patch: ProfileRulePatch<K>,
): ProfileCommand {
  return {
    type: "patchRule",
    profileId,
    collection,
    ruleId,
    patch,
  } as ProfileCommand;
}

export const profileStore = createStore<ProfileStoreState>()((set, get) => {
  const applyDocument = (
    document: ProfileDocument,
    options: { clearHistory: boolean; error?: string | null },
  ) => {
    const profileState = document.state;
    authoritativeDocument = document;
    lastAuthoritativeRevision = Math.max(lastAuthoritativeRevision, document.revision);
    set((state) => ({
      status: "ready",
      revision: document.revision,
      sourceId: document.sourceId,
      profiles: profileState.profiles,
      selectedProfileId: profileState.selectedProfileId,
      error: options.error ?? null,
      past: options.clearHistory ? [] : state.past,
      future: options.clearHistory ? [] : state.future,
    }));
  };

  const synchronizeAfterCommands = async () => {
    if (storageResetPending) return;
    let document = deferredDocument;
    deferredDocument = null;
    if (!document) {
      document = await readStoredProfileDocument();
    }
    if (!document) return;
    if (pendingCommands > 0) {
      rememberDeferredDocument(document);
      return;
    }

    const failureMessage = commandFailed ? get().error : null;
    applyDocument(document, {
      clearHistory:
        sawExternalChange || commandFailed || document.sourceId !== PROFILE_COMMAND_CLIENT_ID,
      error: failureMessage,
    });
    sawExternalChange = false;
    commandFailed = false;
  };

  const dispatchCommand = async (command: ProfileCommand): Promise<boolean> => {
    pendingCommands += 1;
    try {
      const document = await enqueueProfileCommand(command);
      if (storageResetPending) return true;
      if (document.sourceId !== PROFILE_COMMAND_CLIENT_ID) sawExternalChange = true;
      if (lastAuthoritativeRevision > 0 && document.revision > lastAuthoritativeRevision + 1) {
        sawExternalChange = true;
      }
      lastAuthoritativeRevision = Math.max(lastAuthoritativeRevision, document.revision);
      rememberDeferredDocument(document);
      return true;
    } catch (error) {
      commandFailed = true;
      set({ error: errorMessage(error) });
      return false;
    } finally {
      pendingCommands -= 1;
      if (pendingCommands === 0) {
        try {
          if (!storageResetPending) await synchronizeAfterCommands();
        } catch (synchronizationError) {
          const message = errorMessage(synchronizationError);
          if (authoritativeDocument) {
            applyDocument(authoritativeDocument, { clearHistory: true, error: message });
          } else {
            set({ status: "error", error: message });
          }
        } finally {
          resolveCommandSettlementWaiters();
        }
      }
    }
  };

  const commitCommand = async (
    command: ProfileCommand,
    options: { recordHistory?: boolean; past?: ProfileState[]; future?: ProfileState[] } = {},
  ): Promise<boolean> => {
    const current = get();
    const currentDocument = documentOf(current);
    const result = reduceProfileCommand(currentDocument, command, PROFILE_COMMAND_CLIENT_ID);
    if (result.status === "revision-conflict") {
      set({
        error: `Profile revision conflict: expected ${result.expected}, received ${result.actual}`,
      });
      return false;
    }
    if (result.status === "noop") return true;

    const next = result.document;
    const nextProfileState = next.state;
    const recordHistory = options.recordHistory ?? true;
    set({
      revision: next.revision,
      sourceId: next.sourceId,
      profiles: nextProfileState.profiles,
      selectedProfileId: nextProfileState.selectedProfileId,
      error: null,
      past:
        options.past ??
        (recordHistory
          ? [...current.past, profileStateOf(current)].slice(-HISTORY_LIMIT)
          : current.past),
      future: options.future ?? (recordHistory ? [] : current.future),
    });
    return dispatchCommand(command);
  };

  const requestInitialization = (locale: Locale): Promise<void> => {
    if (initializationPromise) return initializationPromise;
    set({ status: "loading", error: null });
    const profile = createLocalizedProfile(1, locale);
    const resetGeneration = storageResetGeneration;
    initializationPromise = enqueueProfileCommand({ type: "initialize", profile })
      .then((document) => {
        if (resetGeneration !== storageResetGeneration) return;
        if (storageResetPending) {
          lastAuthoritativeRevision = document.revision;
          deferredDocument = null;
          sawExternalChange = false;
          commandFailed = false;
          storageResetPending = false;
        }
        applyDocument(document, { clearHistory: true });
      })
      .catch((error) => {
        if (storageResetPending && authoritativeDocument?.state.profiles.length) {
          storageResetPending = false;
          applyDocument(authoritativeDocument, { clearHistory: true });
          return;
        }
        set({ status: "error", error: errorMessage(error) });
      })
      .finally(() => {
        initializationPromise = null;
        if (resetGeneration !== storageResetGeneration) {
          void requestInitialization(currentLocale);
        }
      });
    return initializationPromise;
  };

  return {
    status: "idle",
    revision: 0,
    sourceId: PROFILE_COMMAND_CLIENT_ID,
    error: null,
    profiles: [],
    selectedProfileId: null,
    past: [],
    future: [],

    initialize: async (locale) => {
      currentLocale = locale;
      if (!stopWatchingStorage) {
        stopWatchingStorage = watchStoredProfileDocument((document) => {
          if (document.state.profiles.length === 0) {
            storageResetPending = true;
            storageResetGeneration += 1;
            lastAuthoritativeRevision = document.revision;
            authoritativeDocument = document;
            deferredDocument = null;
            sawExternalChange = false;
            commandFailed = false;
            void requestInitialization(currentLocale);
            return;
          }
          if (storageResetPending) {
            lastAuthoritativeRevision = document.revision;
            authoritativeDocument = document;
            deferredDocument = null;
            sawExternalChange = false;
            commandFailed = false;
            if (pendingCommands > 0) {
              rememberDeferredDocument(document);
              return;
            }
            applyDocument(document, { clearHistory: true });
            if (!initializationPromise) storageResetPending = false;
            return;
          }
          if (document.revision < lastAuthoritativeRevision) return;
          if (pendingCommands > 0) {
            if (document.sourceId !== PROFILE_COMMAND_CLIENT_ID) sawExternalChange = true;
            rememberDeferredDocument(document);
            return;
          }
          applyDocument(document, {
            clearHistory: document.sourceId !== PROFILE_COMMAND_CLIENT_ID,
          });
          if (storageResetPending && !initializationPromise) storageResetPending = false;
        });
      }
      if (get().status === "ready") return;
      await requestInitialization(locale);
    },

    selectProfile: async (profileId) =>
      commitCommand({ type: "selectProfile", profileId }, { recordHistory: false }),

    patchProfile: async (profileId, patch) =>
      commitCommand({ type: "patchProfile", profileId, patch }),

    addRule: async (profileId, collection, rule) =>
      commitCommand(createAddRuleCommand(profileId, collection, rule)),

    patchRule: async (profileId, collection, ruleId, patch) =>
      commitCommand(createPatchRuleCommand(profileId, collection, ruleId, patch)),

    deleteRule: async (profileId, collection, ruleId) =>
      commitCommand({
        type: "deleteRule",
        profileId,
        collection,
        ruleId,
      }),

    cloneRule: async (profileId, collection, ruleId, cloneId) =>
      commitCommand({
        type: "cloneRule",
        profileId,
        collection,
        ruleId,
        cloneId,
      }),

    setRulesEnabled: async (profileId, collection, enabled) =>
      commitCommand({
        type: "setRulesEnabled",
        profileId,
        collection,
        enabled,
      }),

    clearRules: async (profileId, collection) => {
      await waitForPendingCommands();
      return commitCommand({
        type: "clearRules",
        profileId,
        collection,
        expectedRevision: get().revision,
      });
    },

    convertHeader: async (profileId, ruleId, target) =>
      commitCommand({
        type: "convertHeader",
        profileId,
        ruleId,
        target,
      }),

    addFilter: async (profileId, filter) => commitCommand({ type: "addFilter", profileId, filter }),

    patchFilter: async (profileId, filterId, expectedKind, patch) =>
      commitCommand({
        type: "patchFilter",
        profileId,
        filterId,
        expectedKind,
        patch,
      }),

    changeFilterKind: async (profileId, filterId, kind, currentTabId) =>
      commitCommand({
        type: "changeFilterKind",
        profileId,
        filterId,
        kind,
        currentTabId,
      }),

    deleteFilter: async (profileId, filterId) =>
      commitCommand({
        type: "deleteFilter",
        profileId,
        filterId,
      }),

    reorderFilters: async (profileId, sourceFilterId, targetFilterId) =>
      commitCommand({
        type: "reorderFilters",
        profileId,
        sourceFilterId,
        targetFilterId,
      }),

    setFiltersEnabled: async (profileId, enabled) =>
      commitCommand({
        type: "setFiltersEnabled",
        profileId,
        enabled,
      }),

    clearFilters: async (profileId) => {
      await waitForPendingCommands();
      return commitCommand({
        type: "clearFilters",
        profileId,
        expectedRevision: get().revision,
      });
    },

    reorderProfiles: async (fromIndex, toIndex) => {
      const profiles = get().profiles;
      const sourceProfileId = profiles[fromIndex]?.id;
      const targetProfileId = profiles[toIndex]?.id;
      if (!sourceProfileId || !targetProfileId) return true;
      return commitCommand({ type: "reorderProfiles", sourceProfileId, targetProfileId });
    },

    addProfile: async (locale) => {
      const profile = createLocalizedProfile(get().profiles.length + 1, locale);
      return commitCommand({ type: "addProfile", profile });
    },

    cloneProfile: async (profileId, locale) => {
      const state = get();
      const original = state.profiles.find((profile) => profile.id === profileId);
      if (!original) return true;
      const title = i18n.getFixedT(locale)("profile.copyName", { title: original.title });
      return commitCommand({
        type: "cloneProfile",
        sourceProfileId: original.id,
        cloneId: nanoid(),
        title,
        backgroundColor: randomProfileColor(),
      });
    },

    deleteProfile: async (profileId, locale) => {
      return commitCommand({
        type: "deleteProfile",
        profileId,
        replacement: createLocalizedProfile(1, locale),
      });
    },

    importProfiles: async (profiles) => {
      if (profiles.length === 0) return 0;
      const imported = profiles.map((profile) => ({
        ...structuredClone(profile),
        id: nanoid(),
      }));
      return (await commitCommand({ type: "importProfiles", profiles: imported }))
        ? imported.length
        : 0;
    },

    sortProfileRules: async (profileId) => commitCommand({ type: "sortProfileRules", profileId }),

    undo: async () => {
      await waitForPendingCommands();
      const state = get();
      const target = state.past.at(-1);
      if (!target) return true;
      return commitCommand(
        {
          type: "replaceState",
          state: withPreferredProfileSelection(target, state.selectedProfileId),
          expectedRevision: state.revision,
        },
        {
          recordHistory: false,
          past: state.past.slice(0, -1),
          future: [profileStateOf(state), ...state.future].slice(0, HISTORY_LIMIT),
        },
      );
    },

    redo: async () => {
      await waitForPendingCommands();
      const state = get();
      const target = state.future[0];
      if (!target) return true;
      return commitCommand(
        {
          type: "replaceState",
          state: withPreferredProfileSelection(target, state.selectedProfileId),
          expectedRevision: state.revision,
        },
        {
          recordHistory: false,
          past: [...state.past, profileStateOf(state)].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
        },
      );
    },
  };
});

export function useProfileStore<T>(selector: (state: ProfileStoreState) => T): T {
  return useStore(profileStore, selector);
}
