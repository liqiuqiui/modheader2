export type AppendMode = "override" | "append" | "comma";

export interface HeaderRule {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
  appendMode: AppendMode;
  sendEmptyHeader: boolean;
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

export const FILTER_KINDS = [
  "urlPattern",
  "urlRegex",
  "tab",
  "resourceType",
  "method",
  "initiator",
] as const;

export type FilterKind = (typeof FILTER_KINDS)[number];

export const FILTER_MODES = ["include", "exclude"] as const;

export type FilterMode = (typeof FILTER_MODES)[number];

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "stylesheet",
  "image",
  "font",
  "media",
  "object",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

interface BaseProfileFilter<Kind extends FilterKind, Value extends string | number | null> {
  id: string;
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

export type ProfileFilterByKind<K extends FilterKind> = Extract<ProfileFilter, { kind: K }>;

export type ProfileFilterPatch = Partial<
  Pick<ProfileFilter, "enabled" | "mode" | "value" | "comment">
>;

export interface ProfileFilters {
  byId: Record<string, ProfileFilter>;
  order: string[];
}

export interface UrlReplacement {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
}

export interface CookieRule {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
}

export interface Profile {
  id: string;
  title: string;
  shortTitle: string;
  backgroundColor: string;
  textColor: string;
  enabled: boolean;
  paused: boolean;
  hideComment: boolean;
  headers: HeaderRule[];
  respHeaders: HeaderRule[];
  cookies: CookieRule[];
  urlReplacements: UrlReplacement[];
  filters: ProfileFilters;
}

export type ProfileMetadataPatch = Partial<
  Pick<Profile, "title" | "backgroundColor" | "enabled" | "paused" | "hideComment">
>;

export interface ProfileRuleCollectionMap {
  headers: HeaderRule;
  respHeaders: HeaderRule;
  cookies: CookieRule;
  urlReplacements: UrlReplacement;
}

export type ProfileRuleCollection = keyof ProfileRuleCollectionMap;
export type ProfileRule = ProfileRuleCollectionMap[ProfileRuleCollection];
export type ProfileRulePatch<K extends ProfileRuleCollection> = Partial<
  Omit<ProfileRuleCollectionMap[K], "id">
>;
