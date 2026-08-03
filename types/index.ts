import { nanoid } from "nanoid";

// ─── Header 规则 ───────────────────────────────────────────────────────────

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

// ─── 过滤器 ────────────────────────────────────────────────────────────────

export interface UrlFilter {
  id: string;
  enabled: boolean;
  urlRegex: string;
  matchType: "pattern" | "regex";
  comment: string;
}

export interface DomainFilter {
  id: string;
  enabled: boolean;
  domain: string;
  exclude?: boolean;
  comment: string;
}

export interface ResourceFilter {
  id: string;
  enabled: boolean;
  resourceType: string[];
  exclude?: boolean;
  comment: string;
}

export interface TabFilter {
  id: string;
  enabled: boolean;
  tabId: number | string;
  exclude?: boolean;
  comment: string;
}

export type RequestMethod =
  | "connect"
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put";

export interface MethodFilter {
  id: string;
  enabled: boolean;
  method: RequestMethod;
  exclude?: boolean;
  comment: string;
}

export interface TimeFilter {
  id: string;
  enabled: boolean;
  expirationTimeMs: number;
  comment: string;
}

export interface UrlReplacement {
  id: string;
  enabled: boolean;
  name: string; // regex pattern
  value: string; // replacement
  comment: string;
}

export interface CookieRule {
  id: string;
  enabled: boolean;
  name: string;
  value: string;
  comment: string;
}

// ─── Profile ───────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  version: 2;
  title: string;
  shortTitle: string;
  backgroundColor: string;
  textColor: string;
  enabled: boolean;
  paused: boolean;
  hideComment: boolean;
  filterOrder: string[];

  headers: HeaderRule[];
  respHeaders: HeaderRule[];
  cookies: CookieRule[];
  urlReplacements: UrlReplacement[];
  urlFilters: UrlFilter[];
  excludeUrlFilters: UrlFilter[];
  initiatorDomainFilters: DomainFilter[];
  resourceFilters: ResourceFilter[];
  tabFilters: TabFilter[];
  methodFilters: MethodFilter[];
  timeFilters: TimeFilter[];
}

// ─── 全局状态 ──────────────────────────────────────────────────────────────

export interface AppState {
  profiles: Profile[];
  selectedProfileIndex: number;
}

// ─── Factory helpers ───────────────────────────────────────────────────────

export function createHeaderRule(overrides?: Partial<HeaderRule>): HeaderRule {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    appendMode: "override",
    sendEmptyHeader: false,
    ...overrides,
  };
}

export function createUrlFilter(overrides?: Partial<UrlFilter>): UrlFilter {
  return {
    id: nanoid(),
    enabled: true,
    urlRegex: "",
    matchType: "pattern",
    comment: "",
    ...overrides,
  };
}

export function createUrlReplacement(overrides?: Partial<UrlReplacement>): UrlReplacement {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    ...overrides,
  };
}

export function createCookieRule(overrides?: Partial<CookieRule>): CookieRule {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    ...overrides,
  };
}

export function createTabFilter(overrides?: Partial<TabFilter>): TabFilter {
  return { id: nanoid(), enabled: true, tabId: "", exclude: false, comment: "", ...overrides };
}

export function createDomainFilter(overrides?: Partial<DomainFilter>): DomainFilter {
  return { id: nanoid(), enabled: true, domain: "", exclude: false, comment: "", ...overrides };
}

export function createResourceFilter(overrides?: Partial<ResourceFilter>): ResourceFilter {
  return {
    id: nanoid(),
    enabled: true,
    resourceType: ["xmlhttprequest"],
    exclude: false,
    comment: "",
    ...overrides,
  };
}

export function createMethodFilter(overrides?: Partial<MethodFilter>): MethodFilter {
  return { id: nanoid(), enabled: true, method: "get", exclude: false, comment: "", ...overrides };
}
