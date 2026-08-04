import type { ProfileCommand } from "../application/profile-command";
import { isCspDirectiveRule } from "../domain/profile-csp";
import type { ProfileDocument } from "../domain/profile-document";
import { isFilterKind, isFilterMode, isProfileFilter } from "../domain/profile-filter";
import type { ProfileRuleCollection } from "../domain/profile-model";
import {
  isCookieRule,
  isHeaderRule,
  isProfile,
  isProfileDocument,
  isProfileSnapshot,
  isUrlReplacement,
} from "../domain/profile-validation";

export const PROFILE_COMMAND_CHANNEL = "profile-store-command-v2" as const;

export interface ProfileCommandMessage {
  channel: typeof PROFILE_COMMAND_CHANNEL;
  clientId: string;
  command: ProfileCommand;
}

export type ProfileCommandResponse =
  | { ok: true; document: ProfileDocument }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isProfileRuleCollection(value: unknown): value is ProfileRuleCollection {
  return (
    value === "headers" ||
    value === "respHeaders" ||
    value === "csp" ||
    value === "cookies" ||
    value === "urlReplacements"
  );
}

function isProfileMetadataPatch(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["title", "backgroundColor", "enabled", "paused", "hideComment"])
  ) {
    return false;
  }
  return (
    (value.title === undefined || typeof value.title === "string") &&
    (value.backgroundColor === undefined ||
      (typeof value.backgroundColor === "string" && value.backgroundColor.length > 0)) &&
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.paused === undefined || typeof value.paused === "boolean") &&
    (value.hideComment === undefined || typeof value.hideComment === "boolean")
  );
}

function isProfileRule(collection: ProfileRuleCollection, value: unknown): boolean {
  if (collection === "csp") return isHeaderRule(value) && isCspDirectiveRule(value);
  if (collection === "headers" || collection === "respHeaders") return isHeaderRule(value);
  if (collection === "cookies") return isCookieRule(value);
  return isUrlReplacement(value);
}

function isAppendMode(value: unknown): boolean {
  return value === "override" || value === "append" || value === "comma";
}

function isProfileRulePatch(collection: ProfileRuleCollection, value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (collection === "csp") {
    return (
      hasOnlyKeys(value, ["enabled", "value", "comment"]) &&
      (value.enabled === undefined || typeof value.enabled === "boolean") &&
      (value.value === undefined || typeof value.value === "string") &&
      (value.comment === undefined || typeof value.comment === "string")
    );
  }
  const headerCollection = collection === "headers" || collection === "respHeaders";
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
      return isProfile(value.profile);
    case "selectProfile":
    case "sortProfileRules":
      return isNonEmptyString(value.profileId);
    case "patchProfile":
      return isNonEmptyString(value.profileId) && isProfileMetadataPatch(value.patch);
    case "reorderProfiles":
      return isNonEmptyString(value.sourceProfileId) && isNonEmptyString(value.targetProfileId);
    case "addProfile":
      return isProfile(value.profile);
    case "cloneProfile":
      return (
        isNonEmptyString(value.sourceProfileId) &&
        isNonEmptyString(value.cloneId) &&
        typeof value.title === "string" &&
        isNonEmptyString(value.backgroundColor)
      );
    case "deleteProfile":
      return isNonEmptyString(value.profileId) && isProfile(value.replacement);
    case "importProfiles":
      return Array.isArray(value.profiles) && value.profiles.every(isProfile);
    case "addRule":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isProfileRule(value.collection, value.rule)
      );
    case "patchRule":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId) &&
        isProfileRulePatch(value.collection, value.patch)
      );
    case "deleteRule":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId)
      );
    case "cloneRule":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonEmptyString(value.ruleId) &&
        isNonEmptyString(value.cloneId)
      );
    case "setRulesEnabled":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        typeof value.enabled === "boolean"
      );
    case "clearRules":
      return (
        isNonEmptyString(value.profileId) &&
        isProfileRuleCollection(value.collection) &&
        isNonNegativeInteger(value.expectedRevision)
      );
    case "convertHeader":
      return (
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.ruleId) &&
        (value.target === "headers" || value.target === "respHeaders")
      );
    case "addFilter":
      return isNonEmptyString(value.profileId) && isProfileFilter(value.filter);
    case "patchFilter":
      return (
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.filterId) &&
        isFilterKind(value.expectedKind) &&
        isProfileFilterPatch(value.patch)
      );
    case "changeFilterKind":
      return (
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.filterId) &&
        isFilterKind(value.kind) &&
        (value.currentTabId === undefined || isNonNegativeInteger(value.currentTabId))
      );
    case "deleteFilter":
      return isNonEmptyString(value.profileId) && isNonEmptyString(value.filterId);
    case "reorderFilters":
      return (
        isNonEmptyString(value.profileId) &&
        isNonEmptyString(value.sourceFilterId) &&
        isNonEmptyString(value.targetFilterId)
      );
    case "setFiltersEnabled":
      return isNonEmptyString(value.profileId) && typeof value.enabled === "boolean";
    case "clearFilters":
      return isNonEmptyString(value.profileId) && isNonNegativeInteger(value.expectedRevision);
    case "replaceSnapshot":
      return isProfileSnapshot(value.snapshot) && isNonNegativeInteger(value.expectedRevision);
    default:
      return false;
  }
}

export function isProfileCommandMessage(value: unknown): value is ProfileCommandMessage {
  return (
    isRecord(value) &&
    value.channel === PROFILE_COMMAND_CHANNEL &&
    isNonEmptyString(value.clientId) &&
    isProfileCommand(value.command)
  );
}

export function isProfileCommandResponse(value: unknown): value is ProfileCommandResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) return isProfileDocument(value.document);
  return typeof value.error === "string";
}
