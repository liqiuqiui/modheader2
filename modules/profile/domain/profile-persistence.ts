import { cspRuleFromHeaderRule, headerRuleFromCspRule } from "./profile-csp";
import { createProfile } from "./profile-factory";
import type {
  DomainFilter,
  HeaderRule,
  NameValueRule,
  PersistedProfile,
  PersistedHeaderRule,
  PersistedProfileState,
  Profile,
  ResourceFilter,
  RequestMethodFilter,
  TabFilter,
  TabGroupFilter,
  TimeFilter,
  UrlFilter,
  UrlReplacementRule,
  WindowFilter,
} from "./profile-model";
import {
  hasOnlyKeys,
  isAppendMode,
  isNonEmptyString,
  isNonNegativeInteger,
  isRecord,
} from "./profile-guards";
import { isRequestMethod, isResourceType } from "./profile-filter";
import { isHeaderRule, isNameValueRule } from "./profile-validation";

function stableIdentity(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `profile:${(hash >>> 0).toString(36)}`;
}

function withoutId<T extends { id: string }>(value: T): Omit<T, "id"> {
  const { id: _id, ...persisted } = value;
  return persisted;
}

function withoutEditorDefaults(rule: HeaderRule): PersistedHeaderRule {
  const persisted = { ...withoutId(rule) } as PersistedHeaderRule & { appendMode?: string };
  if ((rule.appendMode as string | undefined) === "override") delete persisted.appendMode;
  if (persisted.sendEmptyHeader === false) delete persisted.sendEmptyHeader;
  return persisted;
}

function withId<T extends object>(value: T, identity: string): T & { id: string } {
  return { ...value, id: identity };
}

function withHeaderId(value: PersistedHeaderRule, identity: string): HeaderRule {
  return {
    ...value,
    id: identity,
    appendMode: value.appendMode ?? "override",
    sendEmptyHeader: value.sendEmptyHeader ?? false,
  };
}

function canonicalFilters(profile: Profile) {
  const filters = profile.filters;
  const urlFilters: UrlFilter[] = [];
  const excludeUrlFilters: UrlFilter[] = [];
  const initiatorDomainFilters: DomainFilter[] = [];
  const excludeRequestDomainFilters: DomainFilter[] = [];
  const resourceFilters: ResourceFilter[] = [];
  const tabFilters: TabFilter[] = [];
  const requestMethodFilters: RequestMethodFilter[] = [];

  for (const filter of filters) {
    if (filter.kind === "urlPattern" || filter.kind === "urlRegex") {
      const target = filter.mode === "exclude" ? excludeUrlFilters : urlFilters;
      target.push({
        id: filter.id,
        enabled: filter.enabled,
        urlRegex: String(filter.value),
        comment: filter.comment,
      });
    } else if (filter.kind === "initiator") {
      const target =
        filter.mode === "exclude" ? excludeRequestDomainFilters : initiatorDomainFilters;
      target.push({
        id: filter.id,
        enabled: filter.enabled,
        domain: String(filter.value),
        comment: filter.comment,
      });
    } else if (filter.kind === "resourceType") {
      resourceFilters.push({
        id: filter.id,
        enabled: filter.enabled,
        resourceType: [filter.value],
        comment: filter.comment,
      });
    } else if (filter.kind === "tab") {
      tabFilters.push({
        id: filter.id,
        enabled: filter.enabled,
        tabId: typeof filter.value === "number" ? filter.value : null,
        comment: filter.comment,
      });
    } else if (filter.kind === "method") {
      requestMethodFilters.push({
        id: filter.id,
        enabled: filter.enabled,
        methods: [filter.value],
        comment: filter.comment,
      });
    }
  }

  return {
    urlFilters,
    excludeUrlFilters,
    initiatorDomainFilters,
    excludeRequestDomainFilters,
    resourceFilters,
    tabFilters,
    tabGroupFilters: [] as TabGroupFilter[],
    windowFilters: [] as WindowFilter[],
    timeFilters: [] as TimeFilter[],
    requestMethodFilters,
  };
}

export function toPersistedProfile(profile: Profile): PersistedProfile {
  // The editor command layer mutates the internal collections. Always derive
  // the persisted shape from those collections so a command cannot be lost
  // because a canonical projection is one render behind.
  const headers = profile.rules.requestHeaders;
  const respHeaders = profile.rules.responseHeaders;
  const cookieHeaders = profile.rules.cookies.map((rule) => ({
    id: rule.id,
    enabled: rule.enabled,
    name: rule.name,
    value: rule.value,
    comment: rule.comment,
  }));
  const cspHeaders = profile.rules.csp.map(headerRuleFromCspRule);
  const urlReplacements = profile.rules.redirects;
  const filters = canonicalFilters(profile);

  return {
    version: 2,
    title: profile.title,
    shortTitle: profile.shortTitle,
    backgroundColor: profile.backgroundColor,
    textColor: profile.textColor,
    hideComment: profile.hideComment,
    enabled: profile.enabled,
    paused: profile.paused,
    alwaysOn: profile.alwaysOn,
    headers: headers.map(withoutEditorDefaults),
    respHeaders: respHeaders.map(withoutEditorDefaults),
    cookieHeaders: cookieHeaders.map(withoutEditorDefaults),
    setCookieHeaders: profile.setCookieHeaders.map(withoutEditorDefaults),
    cspHeaders: cspHeaders.map(withoutEditorDefaults),
    urlReplacements: urlReplacements.map(withoutId),
    urlFilters: filters.urlFilters.map(withoutId),
    excludeUrlFilters: filters.excludeUrlFilters.map(withoutId),
    initiatorDomainFilters: filters.initiatorDomainFilters.map(withoutId),
    excludeRequestDomainFilters: filters.excludeRequestDomainFilters.map(withoutId),
    resourceFilters: filters.resourceFilters.map(withoutId),
    tabFilters: filters.tabFilters.map(withoutId),
    tabGroupFilters: filters.tabGroupFilters.map(withoutId),
    windowFilters: filters.windowFilters.map(withoutId),
    timeFilters: filters.timeFilters.map(withoutId),
    requestMethodFilters: filters.requestMethodFilters.map(withoutId),
    reqCookieAppend: profile.reqCookieAppend.map(withoutId),
    // `profileId` is part of the canonical ModHeader profile shape. For local
    // profiles it also acts as the stable editor identity across background
    // storage round-trips; without this fallback every read would generate a
    // new `Profile.id` and commands from the popup could no longer target it.
    profileId: profile.profileId ?? profile.id,
    liveProfileUrl: profile.liveProfileUrl,
    liveProfileStatus: profile.liveProfileStatus,
    liveProfileLastSyncTimestamp: profile.liveProfileLastSyncTimestamp,
    liveProfileIsOwner: profile.liveProfileIsOwner,
  };
}

export function toPersistedState(
  profiles: Profile[],
  selectedProfile: number,
  isPaused: boolean,
): PersistedProfileState {
  return {
    profiles: profiles.map(toPersistedProfile),
    selectedProfile,
    isPaused,
  };
}

export function fromPersistedProfile(value: PersistedProfile): Profile {
  const profile = createProfile({
    title: value.title,
    backgroundColor: value.backgroundColor,
    id: value.profileId ?? stableIdentity(value),
  });
  profile.shortTitle = value.shortTitle;
  profile.textColor = value.textColor;
  profile.hideComment = value.hideComment;
  profile.enabled = value.enabled;
  profile.paused = value.paused;
  profile.alwaysOn = value.alwaysOn;
  const headers = value.headers.map((rule, index) => withHeaderId(rule, `header:request:${index}`));
  const respHeaders = value.respHeaders.map((rule, index) =>
    withHeaderId(rule, `header:response:${index}`),
  );
  const cookieHeaders = value.cookieHeaders.map((rule, index) =>
    withHeaderId(rule, `header:cookie:${index}`),
  );
  const cspHeaders = value.cspHeaders.map((rule, index) =>
    withHeaderId(rule, `header:csp:${index}`),
  );
  const urlReplacements = value.urlReplacements.map((rule, index) =>
    withId(rule, `redirect:${index}`),
  ) as UrlReplacementRule[];
  profile.headers = headers;
  profile.respHeaders = respHeaders;
  profile.cookieHeaders = cookieHeaders;
  profile.setCookieHeaders = value.setCookieHeaders.map((rule, index) =>
    withHeaderId(rule, `header:set-cookie:${index}`),
  );
  profile.cspHeaders = cspHeaders;
  profile.urlReplacements = urlReplacements;
  profile.rules = {
    requestHeaders: headers,
    responseHeaders: respHeaders,
    csp: cspHeaders.map((rule) => cspRuleFromHeaderRule(rule)),
    cookies: cookieHeaders.map((rule) => ({
      id: rule.id,
      enabled: rule.enabled,
      name: rule.name,
      value: rule.value,
      comment: rule.comment,
    })),
    redirects: urlReplacements,
  };
  profile.filters = [];
  profile.urlFilters = value.urlFilters.map((filter, index) =>
    withId(filter, `filter:url:${index}`),
  ) as UrlFilter[];
  profile.excludeUrlFilters = value.excludeUrlFilters.map((filter, index) =>
    withId(filter, `filter:exclude-url:${index}`),
  ) as UrlFilter[];
  profile.initiatorDomainFilters = value.initiatorDomainFilters.map((filter, index) =>
    withId(filter, `filter:initiator:${index}`),
  ) as DomainFilter[];
  profile.excludeRequestDomainFilters = (value.excludeRequestDomainFilters ?? []).map(
    (filter, index) => withId(filter, `filter:exclude-domain:${index}`),
  ) as DomainFilter[];
  profile.resourceFilters = value.resourceFilters.map((filter, index) =>
    withId(filter, `filter:resource:${index}`),
  ) as ResourceFilter[];
  profile.tabFilters = value.tabFilters.map((filter, index) =>
    withId(filter, `filter:tab:${index}`),
  ) as TabFilter[];
  profile.tabGroupFilters = (value.tabGroupFilters ?? []).map((filter, index) =>
    withId(filter, `filter:tab-group:${index}`),
  ) as TabGroupFilter[];
  profile.windowFilters = (value.windowFilters ?? []).map((filter, index) =>
    withId(filter, `filter:window:${index}`),
  ) as WindowFilter[];
  profile.timeFilters = (value.timeFilters ?? []).map((filter, index) =>
    withId(filter, `filter:time:${index}`),
  ) as TimeFilter[];
  profile.requestMethodFilters = (value.requestMethodFilters ?? []).map((filter, index) =>
    withId(filter, `filter:method:${index}`),
  ) as RequestMethodFilter[];
  profile.reqCookieAppend = (value.reqCookieAppend ?? []).map((rule, index) =>
    withId(rule, `cookie-append:${index}`),
  ) as NameValueRule[];

  profile.filters = [
    ...profile.urlFilters.map((filter) => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "urlRegex" as const,
      mode: "include" as const,
      value: filter.urlRegex,
      comment: filter.comment,
    })),
    ...profile.excludeUrlFilters.map((filter) => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "urlRegex" as const,
      mode: "exclude" as const,
      value: filter.urlRegex,
      comment: filter.comment,
    })),
    ...profile.initiatorDomainFilters.map((filter) => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "initiator" as const,
      mode: "include" as const,
      value: filter.domain,
      comment: filter.comment,
    })),
    ...profile.excludeRequestDomainFilters.map((filter) => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "initiator" as const,
      mode: "exclude" as const,
      value: filter.domain,
      comment: filter.comment,
    })),
    ...profile.resourceFilters.flatMap((filter) =>
      filter.resourceType.map((resourceType) => ({
        id: `${filter.id}-${resourceType}`,
        enabled: filter.enabled,
        kind: "resourceType" as const,
        mode: "include" as const,
        value: resourceType,
        comment: filter.comment,
      })),
    ),
    ...profile.tabFilters.map((filter) => ({
      id: filter.id,
      enabled: filter.enabled,
      kind: "tab" as const,
      mode: "include" as const,
      value: filter.tabId,
      comment: filter.comment,
    })),
    ...profile.requestMethodFilters.flatMap((filter) =>
      filter.methods.map((method) => ({
        id: `${filter.id}-${method}`,
        enabled: filter.enabled,
        kind: "method" as const,
        mode: "include" as const,
        value: method,
        comment: filter.comment,
      })),
    ),
  ];
  profile.profileId = value.profileId;
  profile.liveProfileUrl = value.liveProfileUrl;
  profile.liveProfileStatus = value.liveProfileStatus;
  profile.liveProfileLastSyncTimestamp = value.liveProfileLastSyncTimestamp;
  profile.liveProfileIsOwner = value.liveProfileIsOwner;
  return profile;
}

export function fromPersistedState(value: PersistedProfileState): {
  profiles: Profile[];
  selectedProfile: number;
  isPaused: boolean;
} {
  return {
    profiles: value.profiles.map(fromPersistedProfile),
    selectedProfile: value.selectedProfile,
    isPaused: value.isPaused,
  };
}

export function isPersistedProfileState(value: unknown): value is PersistedProfileState {
  if (!isRecord(value) || !Array.isArray(value.profiles)) return false;
  const selectedProfile = value.selectedProfile;
  const isPaused = value.isPaused;
  if (
    typeof selectedProfile !== "number" ||
    !Number.isInteger(selectedProfile) ||
    selectedProfile < 0
  ) {
    return false;
  }
  if (typeof isPaused !== "boolean") return false;
  if (value.profiles.length > 0 && selectedProfile >= value.profiles.length) return false;
  return value.profiles.every(isPersistedProfile);
}

export function isPersistedProfile(value: unknown): value is PersistedProfile {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "version",
      "title",
      "shortTitle",
      "backgroundColor",
      "textColor",
      "hideComment",
      "enabled",
      "paused",
      "alwaysOn",
      "headers",
      "respHeaders",
      "cookieHeaders",
      "setCookieHeaders",
      "cspHeaders",
      "urlReplacements",
      "urlFilters",
      "excludeUrlFilters",
      "initiatorDomainFilters",
      "excludeRequestDomainFilters",
      "resourceFilters",
      "tabFilters",
      "tabGroupFilters",
      "windowFilters",
      "timeFilters",
      "requestMethodFilters",
      "reqCookieAppend",
      "profileId",
      "liveProfileUrl",
      "liveProfileStatus",
      "liveProfileLastSyncTimestamp",
      "liveProfileIsOwner",
    ]) ||
    value.version !== 2 ||
    typeof value.title !== "string" ||
    typeof value.shortTitle !== "string" ||
    typeof value.backgroundColor !== "string" ||
    typeof value.textColor !== "string" ||
    typeof value.hideComment !== "boolean" ||
    typeof value.enabled !== "boolean" ||
    typeof value.paused !== "boolean" ||
    (value.alwaysOn !== undefined && typeof value.alwaysOn !== "boolean")
  ) {
    return false;
  }

  if (
    (value.profileId !== undefined && !isNonEmptyString(value.profileId)) ||
    (value.liveProfileUrl !== undefined && typeof value.liveProfileUrl !== "string") ||
    (value.liveProfileStatus !== undefined &&
      value.liveProfileStatus !== "active" &&
      value.liveProfileStatus !== "paused") ||
    (value.liveProfileLastSyncTimestamp !== undefined &&
      !isNonNegativeInteger(value.liveProfileLastSyncTimestamp)) ||
    (value.liveProfileIsOwner !== undefined && typeof value.liveProfileIsOwner !== "boolean")
  ) {
    return false;
  }

  return (
    isPersistedHeaderArray(value.headers) &&
    isPersistedHeaderArray(value.respHeaders) &&
    isPersistedHeaderArray(value.cookieHeaders, isPersistedNameValueRule) &&
    isPersistedHeaderArray(value.setCookieHeaders) &&
    isPersistedHeaderArray(value.cspHeaders) &&
    isPersistedArray(value.urlReplacements, isPersistedNameValueRule) &&
    isPersistedArray(value.urlFilters, isPersistedUrlFilter) &&
    isPersistedArray(value.excludeUrlFilters, isPersistedUrlFilter) &&
    isPersistedArray(value.initiatorDomainFilters, isPersistedDomainFilter) &&
    isPersistedArray(value.excludeRequestDomainFilters ?? [], isPersistedDomainFilter) &&
    isPersistedArray(value.resourceFilters, isPersistedResourceFilter) &&
    isPersistedArray(value.tabFilters, isPersistedTabFilter) &&
    isPersistedArray(value.tabGroupFilters, isPersistedTabGroupFilter) &&
    isPersistedArray(value.windowFilters, isPersistedWindowFilter) &&
    isPersistedArray(value.timeFilters, isPersistedTimeFilter) &&
    isPersistedArray(value.requestMethodFilters ?? [], isPersistedRequestMethodFilter) &&
    isPersistedHeaderArray(value.reqCookieAppend ?? [], isPersistedNameValueRule)
  );
}

function isPersistedArray<T>(value: unknown, validator: (value: unknown) => boolean): value is T[] {
  return Array.isArray(value) && value.every(validator);
}

function isPersistedHeaderArray(
  value: unknown,
  validator: (value: unknown) => boolean = isPersistedHeaderRule,
): boolean {
  return Array.isArray(value) && value.every(validator);
}

function isPersistedHeaderRule(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["enabled", "name", "value", "comment", "appendMode", "sendEmptyHeader"])
  ) {
    return false;
  }
  if (
    typeof value.enabled !== "boolean" ||
    typeof value.name !== "string" ||
    typeof value.value !== "string" ||
    typeof value.comment !== "string" ||
    (value.appendMode !== undefined &&
      (!isAppendMode(value.appendMode) || value.appendMode === "override")) ||
    (value.sendEmptyHeader !== undefined && typeof value.sendEmptyHeader !== "boolean")
  ) {
    return false;
  }
  return isHeaderRule({
    ...value,
    id: "persisted",
    appendMode: value.appendMode ?? "override",
    sendEmptyHeader: value.sendEmptyHeader ?? false,
  });
}

function isPersistedNameValueRule(value: unknown): boolean {
  return isRecord(value) && isNameValueRule({ ...value, id: "persisted" });
}

function isPersistedUrlFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "urlRegex", "comment"]) &&
    typeof value.enabled === "boolean" &&
    typeof value.urlRegex === "string" &&
    typeof value.comment === "string"
  );
}

function isPersistedDomainFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "domain", "comment"]) &&
    typeof value.enabled === "boolean" &&
    typeof value.domain === "string" &&
    typeof value.comment === "string"
  );
}

function isPersistedResourceFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "resourceType", "comment"]) &&
    typeof value.enabled === "boolean" &&
    isPersistedArray(value.resourceType, isResourceType) &&
    typeof value.comment === "string"
  );
}

function isPersistedTabFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "tabId", "comment"]) &&
    typeof value.enabled === "boolean" &&
    (value.tabId === null || isNonNegativeInteger(value.tabId)) &&
    typeof value.comment === "string"
  );
}

function isPersistedTabGroupFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "groupId", "comment"]) &&
    typeof value.enabled === "boolean" &&
    (value.groupId === null || isNonNegativeInteger(value.groupId)) &&
    typeof value.comment === "string"
  );
}

function isPersistedWindowFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "windowId", "comment"]) &&
    typeof value.enabled === "boolean" &&
    (value.windowId === null || isNonNegativeInteger(value.windowId)) &&
    typeof value.comment === "string"
  );
}

function isPersistedTimeFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "expirationTimeMs", "comment"]) &&
    typeof value.enabled === "boolean" &&
    isNonNegativeInteger(value.expirationTimeMs) &&
    typeof value.comment === "string"
  );
}

function isPersistedRequestMethodFilter(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["enabled", "methods", "comment"]) &&
    typeof value.enabled === "boolean" &&
    isPersistedArray(value.methods, isRequestMethod) &&
    typeof value.comment === "string"
  );
}
