import type { ProfileState } from "../domain/profile-document";
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
