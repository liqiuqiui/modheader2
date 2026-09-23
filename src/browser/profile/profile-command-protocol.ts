import type { ProfileCommand } from "../../services/profile/profile-command";
import { isProfileBackgroundColor } from "../../types/profile/profile-appearance";
import type { ProfileDocument } from "../../types/profile/profile-document";
import { isFilterKind, isFilterMode, isProfileFilter } from "../../types/profile/profile-filter";
import {
  hasExactKeys,
  hasOnlyKeys,
  isArrayOf,
  isAppendMode,
  isNonEmptyString,
  isNonNegativeInteger,
  isProfileRuleCollection,
  isRecord,
} from "../../types/profile/profile-guards";
import type { ProfileRuleCollection } from "../../types/profile/profile-model";
import {
  isCspRule,
  isHeaderRule,
  isNameValueRule,
  isProfile,
  isProfileDocument,
  isProfileState,
} from "../../types/profile/profile-validation";

export const PROFILE_COMMAND_CHANNEL = "profile-operation-command" as const;

export interface ProfileCommandMessage {
  channel: typeof PROFILE_COMMAND_CHANNEL;
  clientId: string;
  command: ProfileCommand;
}

export type ProfileCommandResponse =
  | { ok: true; document: ProfileDocument }
  | { ok: false; error: string };

function isProfileMetadataPatch(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["title", "backgroundColor", "enabled", "paused"])) {
    return false;
  }
  return (
    (value.title === undefined || typeof value.title === "string") &&
    (value.backgroundColor === undefined || isProfileBackgroundColor(value.backgroundColor)) &&
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.paused === undefined || typeof value.paused === "boolean")
  );
}

function isProfileRule(collection: ProfileRuleCollection, value: unknown): boolean {
  if (collection === "requestHeaders" || collection === "responseHeaders") {
    return isHeaderRule(value);
  }
  if (collection === "csp") return isCspRule(value);
  return isNameValueRule(value);
}

function isProfileRulePatch(collection: ProfileRuleCollection, value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (collection === "csp") {
    return (
      hasOnlyKeys(value, ["enabled", "directive", "value", "comment"]) &&
      (value.enabled === undefined || typeof value.enabled === "boolean") &&
      (value.directive === undefined || typeof value.directive === "string") &&
      (value.value === undefined || typeof value.value === "string") &&
      (value.comment === undefined || typeof value.comment === "string")
    );
  }

  const headerCollection = collection === "requestHeaders" || collection === "responseHeaders";
  const allowedKeys = headerCollection
    ? ["enabled", "name", "value", "comment", "appendMode", "sendEmptyHeader"]
    : ["enabled", "name", "value", "comment"];
  if (!hasOnlyKeys(value, allowedKeys)) return false;
  return (
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.value === undefined || typeof value.value === "string") &&
    (value.comment === undefined || typeof value.comment === "string") &&
    (!headerCollection || value.appendMode === undefined || isAppendMode(value.appendMode)) &&
    (!headerCollection ||
      value.sendEmptyHeader === undefined ||
      typeof value.sendEmptyHeader === "boolean")
  );
}

function isProfileFilterPatch(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["enabled", "mode", "value", "comment"])) {
    return false;
  }
  const validValue =
    value.value === undefined ||
    value.value === null ||
    typeof value.value === "string" ||
    isNonNegativeInteger(value.value);
  return (
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.mode === undefined || isFilterMode(value.mode)) &&
    validValue &&
    (value.comment === undefined || typeof value.comment === "string")
  );
}

function isProfileCommand(value: unknown): value is ProfileCommand {
  if (!isRecord(value) || typeof value.type !== "string") return false;

  switch (value.type) {
    case "initialize":
      return hasOnlyKeys(value, ["type", "profile"]) && isProfile(value.profile);
    case "selectProfile":
    case "sortProfileRules":
      return hasOnlyKeys(value, ["type", "profileId"]) && isNonEmptyString(value.profileId);
    case "patchProfile":
      return (
        hasOnlyKeys(value, ["type", "profileId", "patch"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileMetadataPatch(value.patch)
      );
    case "reorderProfiles":
      return (
        hasOnlyKeys(value, ["type", "sourceProfileId", "targetProfileId"]) &&
        isNonEmptyString(value.sourceProfileId) &&
        isNonEmptyString(value.targetProfileId)
      );
    case "addProfile":
      return hasOnlyKeys(value, ["type", "profile"]) && isProfile(value.profile);
    case "cloneProfile":
      return (
        hasOnlyKeys(value, ["type", "sourceProfileId", "cloneId", "title", "backgroundColor"]) &&
        isNonEmptyString(value.sourceProfileId) &&
        isNonEmptyString(value.cloneId) &&
        typeof value.title === "string" &&
        isProfileBackgroundColor(value.backgroundColor)
      );
    case "deleteProfile":
      return (
        hasOnlyKeys(value, ["type", "profileId", "replacement"]) &&
        isNonEmptyString(value.profileId) &&
        isProfile(value.replacement)
      );
    case "importProfiles":
      return hasOnlyKeys(value, ["type", "profiles"]) && isArrayOf(value.profiles, isProfile);
    case "addRule":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "rule"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isProfileRule(value.collection, value.rule)
      );
    case "patchRule":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "ruleId", "patch"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId) &&
        isProfileRulePatch(value.collection, value.patch)
      );
    case "deleteRule":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "ruleId"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId)
      );
    case "cloneRule":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "ruleId", "cloneId"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId) &&
        isNonEmptyString(value.cloneId)
      );
    case "setRulesEnabled":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "enabled"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        typeof value.enabled === "boolean"
      );
    case "clearRules":
      return (
        hasOnlyKeys(value, ["type", "profileId", "collection", "expectedRevision"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonNegativeInteger(value.expectedRevision)
      );
    case "convertHeader":
      return (
        hasOnlyKeys(value, ["type", "profileId", "ruleId", "target"]) &&
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.ruleId) &&
        (value.target === "requestHeaders" || value.target === "responseHeaders")
      );
    case "addFilter":
      return (
        hasOnlyKeys(value, ["type", "profileId", "filter"]) &&
        isNonEmptyString(value.profileId) &&
        isProfileFilter(value.filter)
      );
    case "patchFilter":
      return (
        hasOnlyKeys(value, ["type", "profileId", "filterId", "expectedKind", "patch"]) &&
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.filterId) &&
        isFilterKind(value.expectedKind) &&
        isProfileFilterPatch(value.patch)
      );
    case "changeFilterKind":
      return (
        hasOnlyKeys(value, [
          "type",
          "profileId",
          "filterId",
          "kind",
          "currentTabId",
          "groupId",
          "windowId",
        ]) &&
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.filterId) &&
        isFilterKind(value.kind) &&
        (value.currentTabId === undefined || isNonNegativeInteger(value.currentTabId)) &&
        (value.groupId === undefined || isNonNegativeInteger(value.groupId)) &&
        (value.windowId === undefined || isNonNegativeInteger(value.windowId))
      );
    case "deleteFilter":
      return (
        hasOnlyKeys(value, ["type", "profileId", "filterId"]) &&
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.filterId)
      );
    case "reorderFilters":
      return (
        hasOnlyKeys(value, ["type", "profileId", "sourceFilterId", "targetFilterId"]) &&
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.sourceFilterId) &&
        isNonEmptyString(value.targetFilterId)
      );
    case "setFiltersEnabled":
      return (
        hasOnlyKeys(value, ["type", "profileId", "enabled"]) &&
        isNonEmptyString(value.profileId) &&
        typeof value.enabled === "boolean"
      );
    case "clearFilters":
      return (
        hasOnlyKeys(value, ["type", "profileId", "expectedRevision"]) &&
        isNonEmptyString(value.profileId) &&
        isNonNegativeInteger(value.expectedRevision)
      );
    case "replaceState":
      return (
        hasOnlyKeys(value, ["type", "state", "expectedRevision"]) &&
        isProfileState(value.state) &&
        isNonNegativeInteger(value.expectedRevision)
      );
    default:
      return false;
  }
}

export function isProfileCommandMessage(value: unknown): value is ProfileCommandMessage {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["channel", "clientId", "command"]) &&
    value.channel === PROFILE_COMMAND_CHANNEL &&
    isNonEmptyString(value.clientId) &&
    isProfileCommand(value.command)
  );
}

export function parseProfileCommandResponse(value: unknown): ProfileCommandResponse | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;
  if (value.ok) {
    return hasExactKeys(value, ["ok", "document"]) && isProfileDocument(value.document)
      ? { ok: true, document: value.document }
      : null;
  }
  return hasExactKeys(value, ["ok", "error"]) && typeof value.error === "string"
    ? { ok: false, error: value.error }
    : null;
}
