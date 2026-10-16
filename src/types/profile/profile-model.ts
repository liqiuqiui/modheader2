/** Profile and persistence use one strict editor schema. */

/**
 * `remove` is expressed as an append mode rather than a separate operation
 * field so the editor keeps one control per header row. It compiles to a DNR
 * `remove` action, the only way to delete a header the site already sends.
 *
 * `comma` stays a valid stored value so documents written before it was
 * dropped still load; the compiler resolves it to `append` because DNR has no
 * comma-join operation, so it could never mean more than that.
 */
export type AppendMode = "override" | "append" | "comma" | "remove";

export interface EntityIdentity {
  /** Local editor identity. */
  id: string;
}

export interface HeaderRule extends EntityIdentity {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
  /** Required: `isHeaderRule` validates both fields, and the DNR compiler maps
   * the mode straight to a `set` / `append` operation. */
  appendMode: AppendMode;
  sendEmptyHeader: boolean;
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

/**
 * How a cookie reaches the request.
 *
 * - `set` replaces the whole `cookie` request header with the enabled pairs.
 * - `append` adds the pairs to the header the site already sent, leaving
 *   existing cookies intact. DNR expresses this as an `append` operation, so
 *   several append rules are emitted as separate rules rather than merged.
 */
export type CookieWriteMode = "set" | "append";

export interface CookieRule extends EntityIdentity {
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
  writeMode: CookieWriteMode;
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
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

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
  /** Written to the request `cookie` header. */
  cookies: CookieRule[];
  /** Written to the response `Set-Cookie` header. */
  setCookies: CookieRule[];
  redirects: UrlReplacementRule[];
}

export type ProfileRuleCollection =
  | "requestHeaders"
  | "responseHeaders"
  | "csp"
  | "cookies"
  | "setCookies"
  | "redirects";

export interface ProfileRuleCollectionMap {
  requestHeaders: HeaderRule;
  responseHeaders: HeaderRule;
  csp: CspRule;
  cookies: CookieRule;
  setCookies: CookieRule;
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
  /** Keeps this profile compiled even when another profile is selected. */
  alwaysOn: boolean;
}

export type PersistedProfile = Profile;

export interface PersistedProfileState {
  profiles: PersistedProfile[];
  selectedProfileId: string | null;
  isPaused: boolean;
}

export type ProfileRule = HeaderRule | CspRule | UrlReplacementRule | CookieRule;

export type ProfileRulePatch<K extends ProfileRuleCollection = ProfileRuleCollection> =
  K extends "csp"
    ? Partial<Omit<CspRule, "id">>
    : K extends "requestHeaders" | "responseHeaders"
      ? Partial<Omit<HeaderRule, "id">>
      : Partial<Omit<CookieRule, "id">>;

export type ProfileMetadataPatch = Partial<
  Pick<
    Profile,
    | "title"
    | "shortTitle"
    | "backgroundColor"
    | "textColor"
    | "hideComment"
    | "enabled"
    | "paused"
    | "alwaysOn"
  >
>;
