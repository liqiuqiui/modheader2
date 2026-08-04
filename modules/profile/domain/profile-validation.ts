import type {
  AppendMode,
  CookieRule,
  HeaderRule,
  Profile,
  ProfileFilters,
  UrlReplacement,
} from "./profile-model";
import type { ProfileDocument, ProfileSnapshot } from "./profile-document";
import { PROFILE_DOCUMENT_SCHEMA_VERSION } from "./profile-document";
import { isProfileFilter } from "./profile-filter";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAppendMode(value: unknown): value is AppendMode {
  return value === "override" || value === "append" || value === "comma";
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
  const byId = value.byId;
  const order = value.order;
  const filterIds = Object.keys(byId);
  if (filterIds.length !== order.length) return false;
  if (new Set(order).size !== order.length) return false;
  if (
    !filterIds.every((filterId) => {
      const filter = byId[filterId];
      return isProfileFilter(filter) && filter.id === filterId;
    })
  ) {
    return false;
  }
  return order.every((filterId) => Object.hasOwn(byId, filterId));
}

export function isProfile(value: unknown): value is Profile {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.title !== "string" ||
    typeof value.shortTitle !== "string" ||
    typeof value.backgroundColor !== "string" ||
    value.backgroundColor.length === 0 ||
    typeof value.textColor !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.paused !== "boolean" ||
    typeof value.hideComment !== "boolean" ||
    !Array.isArray(value.headers) ||
    !value.headers.every(isHeaderRule) ||
    !Array.isArray(value.respHeaders) ||
    !value.respHeaders.every(isHeaderRule) ||
    !Array.isArray(value.cookies) ||
    !value.cookies.every(isCookieRule) ||
    !Array.isArray(value.urlReplacements) ||
    !value.urlReplacements.every(isUrlReplacement) ||
    !isProfileFilters(value.filters)
  ) {
    return false;
  }

  const profile = value as unknown as Profile;
  const entityIds = [
    ...profile.headers.map((entity) => entity.id),
    ...profile.respHeaders.map((entity) => entity.id),
    ...profile.cookies.map((entity) => entity.id),
    ...profile.urlReplacements.map((entity) => entity.id),
    ...profile.filters.order,
  ];
  return new Set(entityIds).size === entityIds.length;
}

export function isProfileDocument(value: unknown): value is ProfileDocument {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PROFILE_DOCUMENT_SCHEMA_VERSION ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 0 ||
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
  const profileIds = Object.keys(profilesById);
  if (profileIds.length !== profileOrder.length) return false;
  if (new Set(profileOrder).size !== profileOrder.length) return false;
  if (
    !profileIds.every((profileId) => {
      const profile = profilesById[profileId];
      return isProfile(profile) && profile.id === profileId;
    })
  ) {
    return false;
  }
  if (!profileOrder.every((profileId) => Object.hasOwn(profilesById, profileId))) {
    return false;
  }
  if (profileOrder.length === 0) return selectedProfileId === null;
  return selectedProfileId !== null && profileOrder.includes(selectedProfileId);
}

export function isProfileSnapshot(value: unknown): value is ProfileSnapshot {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) =>
      ["profilesById", "profileOrder", "selectedProfileId"].includes(key),
    )
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
