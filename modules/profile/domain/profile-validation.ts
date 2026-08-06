import type {
  CookieRule,
  HeaderRule,
  Profile,
  ProfileFilters,
  UrlReplacement,
} from "./profile-model";
import type { ProfileDocument, ProfileSnapshot } from "./profile-document";
import { PROFILE_DOCUMENT_SCHEMA_VERSION } from "./profile-document";
import { isProfileFilter } from "./profile-filter";
import {
  hasOnlyKeys,
  isArrayOf,
  isAppendMode,
  isNonEmptyString,
  isNonNegativeInteger,
  isOrderedEntityRecord,
  isRecord,
} from "./profile-guards";
import { profileEntityIds } from "./profile-operations";

function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, (item): item is string => typeof item === "string");
}

export function isHeaderRule(value: unknown): value is HeaderRule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.enabled === "boolean" &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    typeof value.comment === "string" &&
    isAppendMode(value.appendMode) &&
    typeof value.sendEmptyHeader === "boolean" &&
    (value.cspMode === undefined || value.cspMode === "directive")
  );
}

export function isCookieRule(value: unknown): value is CookieRule {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.enabled === "boolean" &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    typeof value.comment === "string"
  );
}

export function isUrlReplacement(value: unknown): value is UrlReplacement {
  return isCookieRule(value);
}

export function isProfileFilters(value: unknown): value is ProfileFilters {
  if (!isRecord(value) || !isRecord(value.byId) || !isStringArray(value.order)) return false;
  return isOrderedEntityRecord(value.byId, value.order, isProfileFilter);
}

export function isProfile(value: unknown): value is Profile {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    typeof value.title !== "string" ||
    typeof value.shortTitle !== "string" ||
    !isNonEmptyString(value.backgroundColor) ||
    typeof value.textColor !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.paused !== "boolean" ||
    typeof value.hideComment !== "boolean" ||
    !isArrayOf(value.headers, isHeaderRule) ||
    !isArrayOf(value.respHeaders, isHeaderRule) ||
    !isArrayOf(value.cookies, isCookieRule) ||
    !isArrayOf(value.urlReplacements, isUrlReplacement) ||
    !isProfileFilters(value.filters)
  ) {
    return false;
  }

  const profile = value as unknown as Profile;
  const entityIds = profileEntityIds(profile);
  return new Set(entityIds).size === entityIds.length;
}

export function isProfileDocument(value: unknown): value is ProfileDocument {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PROFILE_DOCUMENT_SCHEMA_VERSION ||
    !isNonNegativeInteger(value.revision) ||
    typeof value.sourceId !== "string" ||
    !isRecord(value.profilesById) ||
    !isStringArray(value.profileOrder) ||
    (value.selectedProfileId !== null && typeof value.selectedProfileId !== "string")
  ) {
    return false;
  }

  const profilesById = value.profilesById;
  const profileOrder = value.profileOrder;
  const selectedProfileId = value.selectedProfileId;
  if (!isOrderedEntityRecord(profilesById, profileOrder, isProfile)) return false;
  if (profileOrder.length === 0) return selectedProfileId === null;
  return selectedProfileId !== null && profileOrder.includes(selectedProfileId);
}

export function isProfileSnapshot(value: unknown): value is ProfileSnapshot {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["profilesById", "profileOrder", "selectedProfileId"])
  ) {
    return false;
  }
  return isProfileDocument({
    schemaVersion: PROFILE_DOCUMENT_SCHEMA_VERSION,
    revision: 0,
    sourceId: "",
    profilesById: value.profilesById,
    profileOrder: value.profileOrder,
    selectedProfileId: value.selectedProfileId,
  });
}
