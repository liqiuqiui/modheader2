import type { ProfileState } from "../../types/profile/profile-document";
import type {
  FilterKind,
  Profile,
  ProfileFilter,
  ProfileFilterPatch,
  ProfileMetadataPatch,
  ProfileRuleCollection,
  ProfileRuleCollectionMap,
  ProfileRulePatch,
} from "../../types/profile/profile-model";

export type AddProfileRuleCommand<K extends ProfileRuleCollection = ProfileRuleCollection> = {
  type: "addRule";
  profileId: string;
  collection: K;
  rule: ProfileRuleCollectionMap[K];
};

export type PatchProfileRuleCommand<K extends ProfileRuleCollection = ProfileRuleCollection> = {
  type: "patchRule";
  profileId: string;
  collection: K;
  ruleId: string;
  patch: ProfileRulePatch<K>;
};

export type ProfileCommand =
  | { type: "initialize"; profile: Profile }
  | { type: "selectProfile"; profileId: string }
  /** Global kill switch: clears every compiled rule regardless of profile. */
  | { type: "setGlobalPaused"; paused: boolean }
  | { type: "patchProfile"; profileId: string; patch: ProfileMetadataPatch }
  | {
      type: "reorderProfiles";
      sourceProfileId: string;
      targetProfileId: string;
    }
  | { type: "addProfile"; profile: Profile }
  | {
      type: "cloneProfile";
      sourceProfileId: string;
      cloneId: string;
      title: string;
      backgroundColor: string;
    }
  | { type: "deleteProfile"; profileId: string; replacement: Profile }
  | { type: "importProfiles"; profiles: Profile[] }
  /** Folds imported profiles into an existing one instead of appending them. */
  | { type: "mergeProfile"; targetProfileId: string; source: Profile }
  | {
      [K in ProfileRuleCollection]: AddProfileRuleCommand<K>;
    }[ProfileRuleCollection]
  | {
      [K in ProfileRuleCollection]: PatchProfileRuleCommand<K>;
    }[ProfileRuleCollection]
  | {
      type: "deleteRule";
      profileId: string;
      collection: ProfileRuleCollection;
      ruleId: string;
    }
  | {
      type: "cloneRule";
      profileId: string;
      collection: ProfileRuleCollection;
      ruleId: string;
      cloneId: string;
    }
  | {
      type: "setRulesEnabled";
      profileId: string;
      collection: ProfileRuleCollection;
      enabled: boolean;
    }
  | {
      type: "clearRules";
      profileId: string;
      collection: ProfileRuleCollection;
      expectedRevision: number;
    }
  | {
      type: "convertHeader";
      profileId: string;
      ruleId: string;
      target: "requestHeaders" | "responseHeaders";
    }
  | { type: "addFilter"; profileId: string; filter: ProfileFilter }
  | {
      type: "patchFilter";
      profileId: string;
      filterId: string;
      expectedKind: FilterKind;
      patch: ProfileFilterPatch;
    }
  | {
      type: "changeFilterKind";
      profileId: string;
      filterId: string;
      kind: FilterKind;
      currentTabId?: number;
      groupId?: number;
      windowId?: number;
    }
  | { type: "deleteFilter"; profileId: string; filterId: string }
  | {
      type: "reorderFilters";
      profileId: string;
      sourceFilterId: string;
      targetFilterId: string;
    }
  | { type: "setFiltersEnabled"; profileId: string; enabled: boolean }
  | { type: "clearFilters"; profileId: string; expectedRevision: number }
  | { type: "sortProfileRules"; profileId: string }
  /** Orders profiles by title; the sidebar default order is user-defined. */
  | { type: "sortProfilesByTitle" }
  | { type: "replaceState"; state: ProfileState; expectedRevision: number };

export function expectedProfileCommandRevision(command: ProfileCommand): number | undefined {
  if (
    command.type === "clearRules" ||
    command.type === "clearFilters" ||
    command.type === "replaceState"
  ) {
    return command.expectedRevision;
  }
  return undefined;
}
