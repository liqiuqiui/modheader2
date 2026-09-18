import { isContentSecurityPolicyHeaderRule } from "./profile-csp";
import { isProfileBackgroundColor } from "./profile-appearance";
import type { ProfileDocument, ProfileState } from "./profile-document";
import { PROFILE_DOCUMENT_SCHEMA_VERSION } from "./profile-document";
import { isProfileFilter } from "./profile-filter";
import {
  hasExactKeys,
  hasOnlyKeys,
  isAppendMode,
  isArrayOf,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
} from "./profile-guards";
import type { CspRule, HeaderRule, NameValueRule, Profile, ProfileRules } from "./profile-model";
import { profileEntityIds } from "./profile-operations";

export function isHeaderRule(value: unknown): value is HeaderRule {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "enabled",
      "name",
      "value",
      "comment",
      "appendMode",
      "sendEmptyHeader",
    ]) &&
    isNonEmptyString(value.id) &&
    typeof value.enabled === "boolean" &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    typeof value.comment === "string" &&
    isAppendMode(value.appendMode) &&
    typeof value.sendEmptyHeader === "boolean"
  );
}

export function isCspRule(value: unknown): value is CspRule {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "enabled", "directive", "value", "comment"]) &&
    isNonEmptyString(value.id) &&
    typeof value.enabled === "boolean" &&
    typeof value.directive === "string" &&
    typeof value.value === "string" &&
    typeof value.comment === "string"
  );
}

export function isNameValueRule(value: unknown): value is NameValueRule {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "enabled", "name", "value", "comment"]) &&
    isNonEmptyString(value.id) &&
    typeof value.enabled === "boolean" &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    typeof value.comment === "string"
  );
}

export function isProfileRules(value: unknown): value is ProfileRules {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["requestHeaders", "responseHeaders", "csp", "cookies", "redirects"]) &&
    isArrayOf(value.requestHeaders, isHeaderRule) &&
    isArrayOf(value.responseHeaders, isHeaderRule) &&
    value.responseHeaders.every((rule) => !isContentSecurityPolicyHeaderRule(rule)) &&
    isArrayOf(value.csp, isCspRule) &&
    isArrayOf(value.cookies, isNameValueRule) &&
    isArrayOf(value.redirects, isNameValueRule)
  );
}

export function isProfile(value: unknown): value is Profile {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "version",
      "title",
      "shortTitle",
      "backgroundColor",
      "textColor",
      "hideComment",
      "enabled",
      "paused",
      "rules",
      "filters",
    ]) ||
    !isNonEmptyString(value.id) ||
    typeof value.title !== "string" ||
    value.version !== 1 ||
    typeof value.shortTitle !== "string" ||
    !isProfileBackgroundColor(value.backgroundColor) ||
    typeof value.textColor !== "string" ||
    typeof value.hideComment !== "boolean" ||
    typeof value.enabled !== "boolean" ||
    typeof value.paused !== "boolean" ||
    !isProfileRules(value.rules) ||
    !isArrayOf(value.filters, isProfileFilter)
  ) {
    return false;
  }

  const entityIds = profileEntityIds(value as unknown as Profile);
  return new Set(entityIds).size === entityIds.length;
}

export function isProfileState(value: unknown): value is ProfileState {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["profiles", "selectedProfileId"]) ||
    !isArrayOf(value.profiles, isProfile) ||
    (value.selectedProfileId !== null && typeof value.selectedProfileId !== "string")
  ) {
    return false;
  }

  const profiles = value.profiles;
  const profileIds = profiles.map((profile) => profile.id);
  if (new Set(profileIds).size !== profileIds.length) return false;
  if (profiles.length === 0) return value.selectedProfileId === null;
  return value.selectedProfileId !== null && profileIds.includes(value.selectedProfileId);
}

export function isProfileDocument(value: unknown): value is ProfileDocument {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["schemaVersion", "revision", "sourceId", "state", "isPaused"]) &&
    value.schemaVersion === PROFILE_DOCUMENT_SCHEMA_VERSION &&
    isNonNegativeInteger(value.revision) &&
    typeof value.sourceId === "string" &&
    typeof value.isPaused === "boolean" &&
    isProfileState(value.state)
  );
}
