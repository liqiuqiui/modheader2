/**
 * Canonical ModHeader profile data model.
 *
 * The persisted shape intentionally mirrors the upstream extension: rules and
 * filters live directly on Profile instead of being nested below `rules` and
 * `filters`. `id` is an editor-only identity used by the local UI/command
 * layer; it is not part of the ModHeader interchange contract.
 */

export type AppendMode = "override" | "append" | "comma";

export interface EntityIdentity {
  /** Local editor identity. */
  id: string;
}

export interface HeaderRule extends EntityIdentity {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
  appendMode?: AppendMode;
  sendEmptyHeader?: boolean;
}

export interface CspRule extends EntityIdentity {
  enabled: boolean;
  directive: string;
  value: string;
  comment: string;
}

export interface NameValueRule extends EntityIdentity {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
}

export interface UrlReplacementRule extends EntityIdentity {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
}

export const REQUEST_METHODS = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
] as const;

export type RequestMethod = (typeof REQUEST_METHODS)[number];

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "media",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const ALL_RESOURCE_TYPES = [
  ...RESOURCE_TYPES,
  "ping",
  "csp_report",
  "websocket",
  "webtransport",
  "webbundle",
] as const;

export interface UrlFilter extends EntityIdentity {
  enabled: boolean;
  urlRegex: string;
  comment: string;
}

export interface DomainFilter extends EntityIdentity {
  enabled: boolean;
  domain: string;
  comment: string;
}

export interface ResourceFilter extends EntityIdentity {
  enabled: boolean;
  resourceType: ResourceType[];
  comment: string;
}

export interface TabFilter extends EntityIdentity {
  enabled: boolean;
  tabId: number | null;
  comment: string;
}

export interface TabGroupFilter extends EntityIdentity {
  enabled: boolean;
  groupId: number | null;
  comment: string;
}

export interface WindowFilter extends EntityIdentity {
  enabled: boolean;
  windowId: number | null;
  comment: string;
}

export interface TimeFilter extends EntityIdentity {
  enabled: boolean;
  expirationTimeMs: number;
  comment: string;
}

export interface RequestMethodFilter extends EntityIdentity {
  enabled: boolean;
  methods: RequestMethod[];
  comment: string;
}

/** Editor command filter shape retained internally while the canonical
 * persisted shape uses the dedicated filter arrays above. */
export type FilterKind =
  | "urlPattern"
  | "urlRegex"
  | "tab"
  | "resourceType"
  | "method"
  | "initiator";
export type FilterMode = "include" | "exclude";

export const FILTER_KINDS: readonly FilterKind[] = [
  "urlPattern",
  "urlRegex",
  "tab",
  "resourceType",
  "method",
  "initiator",
];
export const FILTER_MODES: readonly FilterMode[] = ["include", "exclude"];

interface BaseProfileFilter<
  Kind extends FilterKind,
  Value extends string | number | null,
> extends EntityIdentity {
  enabled: boolean;
  kind: Kind;
  mode: FilterMode;
  value: Value;
  comment: string;
}

export type ProfileFilter =
  | BaseProfileFilter<"urlPattern", string>
  | BaseProfileFilter<"urlRegex", string>
  | BaseProfileFilter<"tab", number | null>
  | BaseProfileFilter<"resourceType", ResourceType>
  | BaseProfileFilter<"method", RequestMethod>
  | BaseProfileFilter<"initiator", string>;

export type LegacyProfileFilter = ProfileFilter;
export type ProfileFilterByKind<K extends FilterKind> = Extract<ProfileFilter, { kind: K }>;
export type ProfileFilterPatch = Partial<
  Pick<LegacyProfileFilter, "enabled" | "mode" | "value" | "comment">
>;

export type CspLegacyRule = CspRule;

export interface ProfileRules {
  requestHeaders: HeaderRule[];
  responseHeaders: HeaderRule[];
  csp: CspLegacyRule[];
  cookies: NameValueRule[];
  redirects: UrlReplacementRule[];
}

export type ProfileRuleCollection =
  | "requestHeaders"
  | "responseHeaders"
  | "csp"
  | "cookies"
  | "redirects";

export type CanonicalProfileRuleCollection =
  | "headers"
  | "respHeaders"
  | "cookieHeaders"
  | "setCookieHeaders"
  | "cspHeaders"
  | "urlReplacements"
  | "reqCookieAppend";

export interface ProfileRuleCollectionMap {
  requestHeaders: HeaderRule;
  responseHeaders: HeaderRule;
  csp: CspRule;
  cookies: NameValueRule;
  redirects: UrlReplacementRule;
}

export interface Profile {
  version: 2;
  id: string;
  title: string;
  shortTitle: string;
  backgroundColor: string;
  textColor: string;
  hideComment: boolean;

  headers: HeaderRule[];
  respHeaders: HeaderRule[];
  cookieHeaders: HeaderRule[];
  setCookieHeaders: HeaderRule[];
  cspHeaders: HeaderRule[];
  urlReplacements: UrlReplacementRule[];

  urlFilters: UrlFilter[];
  excludeUrlFilters: UrlFilter[];
  initiatorDomainFilters: DomainFilter[];
  excludeRequestDomainFilters: DomainFilter[];
  resourceFilters: ResourceFilter[];
  tabFilters: TabFilter[];
  tabGroupFilters: TabGroupFilter[];
  windowFilters: WindowFilter[];
  timeFilters: TimeFilter[];
  requestMethodFilters: RequestMethodFilter[];
  reqCookieAppend: NameValueRule[];

  /** Internal editor projection; not part of the canonical persisted format. */
  rules: ProfileRules;
  filters: LegacyProfileFilter[];
  enabled: boolean;
  paused: boolean;

  alwaysOn?: boolean;
  profileId?: string;
  liveProfileUrl?: string;
  liveProfileStatus?: "active" | "paused";
  liveProfileLastSyncTimestamp?: number;
  liveProfileIsOwner?: boolean;
}

/** Exact interchange/storage profile shape. */
export interface PersistedProfile {
  version: 2;
  title: string;
  shortTitle: string;
  backgroundColor: string;
  textColor: string;
  hideComment: boolean;
  enabled: boolean;
  paused: boolean;
  alwaysOn?: boolean;
  headers: PersistedHeaderRule[];
  respHeaders: PersistedHeaderRule[];
  cookieHeaders: PersistedHeaderRule[];
  setCookieHeaders: PersistedHeaderRule[];
  cspHeaders: PersistedHeaderRule[];
  urlReplacements: Omit<UrlReplacementRule, "id">[];
  urlFilters: Omit<UrlFilter, "id">[];
  excludeUrlFilters: Omit<UrlFilter, "id">[];
  initiatorDomainFilters: Omit<DomainFilter, "id">[];
  excludeRequestDomainFilters?: Omit<DomainFilter, "id">[];
  resourceFilters: Omit<ResourceFilter, "id">[];
  tabFilters: Omit<TabFilter, "id">[];
  tabGroupFilters: Omit<TabGroupFilter, "id">[];
  windowFilters: Omit<WindowFilter, "id">[];
  timeFilters: Omit<TimeFilter, "id">[];
  requestMethodFilters?: Omit<RequestMethodFilter, "id">[];
  reqCookieAppend?: Omit<NameValueRule, "id">[];
  profileId?: string;
  liveProfileUrl?: string;
  liveProfileStatus?: "active" | "paused";
  liveProfileLastSyncTimestamp?: number;
  liveProfileIsOwner?: boolean;
}

export interface PersistedHeaderRule {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
  appendMode?: "append" | "comma";
  sendEmptyHeader?: boolean;
}

export interface PersistedProfileState {
  profiles: PersistedProfile[];
  selectedProfile: number;
  isPaused: boolean;
}

export type ProfileRule = HeaderRule | CspRule | UrlReplacementRule | NameValueRule;

export type ProfileRulePatch<K extends ProfileRuleCollection = ProfileRuleCollection> =
  K extends "csp"
    ? Partial<Omit<CspRule, "id">>
    : K extends "requestHeaders" | "responseHeaders"
      ? Partial<Omit<HeaderRule, "id">>
      : Partial<Omit<NameValueRule, "id">>;

export type ProfileMetadataPatch = Partial<
  Pick<
    Profile,
    | "title"
    | "shortTitle"
    | "backgroundColor"
    | "textColor"
    | "hideComment"
    | "alwaysOn"
    | "profileId"
    | "liveProfileUrl"
    | "liveProfileStatus"
    | "enabled"
    | "paused"
  >
>;

export type AnyProfileFilter =
  | UrlFilter
  | DomainFilter
  | ResourceFilter
  | TabFilter
  | TabGroupFilter
  | WindowFilter
  | TimeFilter
  | RequestMethodFilter;
