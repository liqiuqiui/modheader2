import type { Locale } from "../config/locales";
import type { BrowserTab } from "../types/browser";
import type { EditorMode } from "../pages/editor/types";
import type { ProfileState } from "../types/profile/profile-document";
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
import type {
  ProfileDataState,
  ProfileHistoryState,
  ProfileSyncState,
  ProfileSyncStatus,
} from "./app-state";

export type ProfileOperationStatus = ProfileSyncStatus;

export interface AppStoreState extends ProfileDataState, ProfileHistoryState, ProfileSyncState {
  mode: EditorMode;
  collapsed: boolean;
  searchQuery: string;
  notice: string;
  focusRequest: { kind: "header" | "csp" | "cookie" | "filter"; id: string } | null;
  tabs: BrowserTab[];
  currentTabId?: number;
  initializeEditor: (mode: EditorMode) => () => void;
  setCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  showNotice: (message: string) => void;
  requestFocus: (kind: "header" | "csp" | "cookie" | "filter", id: string) => void;
  clearFocusRequest: () => void;
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

export type ProfileStateSnapshot = Pick<ProfileState, "profiles" | "selectedProfileId">;
