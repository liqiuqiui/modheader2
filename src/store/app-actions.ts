import { nanoid } from "nanoid";
import type { Locale } from "../config/locales";
import i18n from "../i18n";
import type { ProfileCommand } from "../services/profile/profile-command";
import { randomProfileColor } from "../types/profile/profile-appearance";
import {
  withPreferredProfileSelection,
  type ProfileState,
} from "../types/profile/profile-document";
import type {
  FilterKind,
  Profile,
  ProfileFilter,
  ProfileFilterPatch,
  ProfileMetadataPatch,
  ProfileRuleCollection,
  ProfileRuleCollectionMap,
  ProfileRulePatch,
} from "../types/profile/profile-model";
import type { AppStoreState } from "./app-store-contract";
import { profileStateOf } from "./app-state";
import type { AppRuntime } from "./app-runtime";
import { waitForPendingCommands } from "./app-runtime";

type CommitCommand = (
  command: ProfileCommand,
  options?: { recordHistory?: boolean; past?: ProfileState[]; future?: ProfileState[] },
) => Promise<boolean>;

function addRuleCommand<K extends ProfileRuleCollection>(
  profileId: string,
  collection: K,
  rule: ProfileRuleCollectionMap[K],
): ProfileCommand {
  return { type: "addRule", profileId, collection, rule } as ProfileCommand;
}

function patchRuleCommand<K extends ProfileRuleCollection>(
  profileId: string,
  collection: K,
  ruleId: string,
  patch: ProfileRulePatch<K>,
): ProfileCommand {
  return { type: "patchRule", profileId, collection, ruleId, patch } as ProfileCommand;
}

type ProfileOperationActions = Omit<
  AppStoreState,
  | "profiles"
  | "selectedProfileId"
  | "revision"
  | "sourceId"
  | "isPaused"
  | "past"
  | "future"
  | "status"
  | "error"
  | "initialize"
  | "mode"
  | "collapsed"
  | "searchQuery"
  | "notice"
  | "focusRequest"
  | "tabs"
  | "currentTabId"
  | "initializeEditor"
  | "setCollapsed"
  | "setSearchQuery"
  | "showNotice"
  | "requestFocus"
  | "clearFocusRequest"
>;

interface ProfileOperationActionsContext {
  runtime: AppRuntime;
  get: () => AppStoreState;
  commitCommand: CommitCommand;
  createLocalizedProfile: (number: number, locale: Locale) => Profile;
}

export function createAppActions({
  runtime,
  get,
  commitCommand,
  createLocalizedProfile,
}: ProfileOperationActionsContext): ProfileOperationActions {
  return {
    selectProfile: async (profileId) =>
      commitCommand({ type: "selectProfile", profileId }, { recordHistory: false }),
    patchProfile: async (profileId, patch: ProfileMetadataPatch) =>
      commitCommand({ type: "patchProfile", profileId, patch }),
    addRule: async <K extends ProfileRuleCollection>(
      profileId: string,
      collection: K,
      rule: ProfileRuleCollectionMap[K],
    ) => commitCommand(addRuleCommand(profileId, collection, rule)),
    patchRule: async <K extends ProfileRuleCollection>(
      profileId: string,
      collection: K,
      ruleId: string,
      patch: ProfileRulePatch<K>,
    ) => commitCommand(patchRuleCommand(profileId, collection, ruleId, patch)),
    deleteRule: async (profileId, collection, ruleId) =>
      commitCommand({ type: "deleteRule", profileId, collection, ruleId }),
    cloneRule: async (profileId, collection, ruleId, cloneId) =>
      commitCommand({ type: "cloneRule", profileId, collection, ruleId, cloneId }),
    setRulesEnabled: async (profileId, collection, enabled) =>
      commitCommand({ type: "setRulesEnabled", profileId, collection, enabled }),
    clearRules: async (profileId, collection) => {
      await waitForPendingCommands(runtime);
      return commitCommand({
        type: "clearRules",
        profileId,
        collection,
        expectedRevision: get().revision,
      });
    },
    convertHeader: async (profileId, ruleId, target) =>
      commitCommand({ type: "convertHeader", profileId, ruleId, target }),
    addFilter: async (profileId, filter: ProfileFilter) =>
      commitCommand({ type: "addFilter", profileId, filter }),
    patchFilter: async (profileId, filterId, expectedKind: FilterKind, patch: ProfileFilterPatch) =>
      commitCommand({ type: "patchFilter", profileId, filterId, expectedKind, patch }),
    changeFilterKind: async (profileId, filterId, kind, currentTabId) =>
      commitCommand({ type: "changeFilterKind", profileId, filterId, kind, currentTabId }),
    deleteFilter: async (profileId, filterId) =>
      commitCommand({ type: "deleteFilter", profileId, filterId }),
    reorderFilters: async (profileId, sourceFilterId, targetFilterId) =>
      commitCommand({ type: "reorderFilters", profileId, sourceFilterId, targetFilterId }),
    setFiltersEnabled: async (profileId, enabled) =>
      commitCommand({ type: "setFiltersEnabled", profileId, enabled }),
    clearFilters: async (profileId) => {
      await waitForPendingCommands(runtime);
      return commitCommand({ type: "clearFilters", profileId, expectedRevision: get().revision });
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
      const original = get().profiles.find((profile) => profile.id === profileId);
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
    deleteProfile: async (profileId, locale) =>
      commitCommand({
        type: "deleteProfile",
        profileId,
        replacement: createLocalizedProfile(1, locale),
      }),
    importProfiles: async (profiles) => {
      if (profiles.length === 0) return 0;
      const imported = profiles.map((profile) => ({ ...structuredClone(profile), id: nanoid() }));
      return (await commitCommand({ type: "importProfiles", profiles: imported }))
        ? imported.length
        : 0;
    },
    sortProfileRules: async (profileId) => commitCommand({ type: "sortProfileRules", profileId }),
    undo: async () => {
      await waitForPendingCommands(runtime);
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
          future: [profileStateOf(state), ...state.future].slice(0, 50),
        },
      );
    },
    redo: async () => {
      await waitForPendingCommands(runtime);
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
          past: [...state.past, profileStateOf(state)].slice(-50),
          future: state.future.slice(1),
        },
      );
    },
  };
}
