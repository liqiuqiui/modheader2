/** Profile and persistence use one strict editor schema. */

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
  | "tabGroup"
  | "window"
  | "resourceType"
  | "method"
  | "initiator"
  | "requestDomain"
  | "time";
export type FilterMode = "include" | "exclude";

export const FILTER_KINDS: readonly FilterKind[] = [
  "urlPattern",
  "urlRegex",
  "tab",
  "tabGroup",
  "window",
  "resourceType",
  "method",
  "initiator",
  "requestDomain",
  "time",
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
  | BaseProfileFilter<"tabGroup", number | null>
  | BaseProfileFilter<"window", number | null>
  | BaseProfileFilter<"resourceType", ResourceType>
  | BaseProfileFilter<"method", RequestMethod>
  | BaseProfileFilter<"initiator", string>
  | BaseProfileFilter<"requestDomain", string>
  | BaseProfileFilter<"time", number>;

export type ProfileFilterByKind<K extends FilterKind> = Extract<ProfileFilter, { kind: K }>;
export type ProfileFilterPatch = Partial<
  Pick<ProfileFilter, "enabled" | "mode" | "value" | "comment">
>;

export interface ProfileRules {
  requestHeaders: HeaderRule[];
  responseHeaders: HeaderRule[];
  csp: CspRule[];
  cookies: NameValueRule[];
  redirects: UrlReplacementRule[];
}

export type ProfileRuleCollection =
  | "requestHeaders"
  | "responseHeaders"
  | "csp"
  | "cookies"
  | "redirects";

export interface ProfileRuleCollectionMap {
  requestHeaders: HeaderRule;
  responseHeaders: HeaderRule;
  csp: CspRule;
  cookies: NameValueRule;
  redirects: UrlReplacementRule;
}

export interface Profile {
  version: 1;
  id: string;
  title: string;
  shortTitle: string;
  backgroundColor: string;
  textColor: string;
  hideComment: boolean;

  rules: ProfileRules;
  filters: ProfileFilter[];
  enabled: boolean;
  paused: boolean;
}

export type PersistedProfile = Profile;

export interface PersistedProfileState {
  profiles: PersistedProfile[];
  selectedProfileId: string | null;
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
    "title" | "shortTitle" | "backgroundColor" | "textColor" | "hideComment" | "enabled" | "paused"
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
