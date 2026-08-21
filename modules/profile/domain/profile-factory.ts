import { nanoid } from "nanoid";
import { randomProfileColor } from "./profile-appearance";
import type {
  CspRule,
  HeaderRule,
  LegacyProfileFilter,
  NameValueRule,
  Profile,
  ProfileRules,
  UrlReplacementRule,
} from "./profile-model";

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

export function createCspRule(overrides?: Partial<CspRule>): CspRule {
  return {
    id: nanoid(),
    enabled: true,
    directive: "",
    value: "",
    comment: "",
    ...overrides,
  };
}

function createNameValueRule(overrides?: Partial<NameValueRule>): NameValueRule {
  return {
    id: nanoid(),
    enabled: true,
    name: "",
    value: "",
    comment: "",
    ...overrides,
  };
}

export function createCookieRule(overrides?: Partial<NameValueRule>): NameValueRule {
  return createNameValueRule(overrides);
}

export function createRedirectRule(overrides?: Partial<UrlReplacementRule>): UrlReplacementRule {
  return createNameValueRule(overrides) as UrlReplacementRule;
}

function emptyCanonicalFilters() {
  return {
    urlFilters: [],
    excludeUrlFilters: [],
    initiatorDomainFilters: [],
    excludeRequestDomainFilters: [],
    resourceFilters: [],
    tabFilters: [],
    tabGroupFilters: [],
    windowFilters: [],
    timeFilters: [],
    requestMethodFilters: [],
    reqCookieAppend: [],
  };
}

function createEditorRules(): ProfileRules {
  return {
    requestHeaders: [createHeaderRule()],
    responseHeaders: [],
    csp: [],
    cookies: [],
    redirects: [],
  };
}

function createEditorFilters(): LegacyProfileFilter[] {
  return [];
}

export function createProfile({
  title,
  backgroundColor = randomProfileColor(),
  id = nanoid(),
}: {
  title: string;
  backgroundColor?: string;
  id?: string;
}): Profile {
  const rules = createEditorRules();
  const filters = createEditorFilters();
  return {
    version: 2,
    id,
    title,
    shortTitle: title.at(-1) ?? "0",
    backgroundColor,
    textColor: "#ffffff",
    hideComment: true,
    // Keep the canonical profile identity aligned with the editor identity so
    // a background storage round-trip does not invalidate pending commands.
    profileId: id,

    headers: rules.requestHeaders,
    respHeaders: rules.responseHeaders,
    cookieHeaders: rules.cookies,
    setCookieHeaders: [],
    cspHeaders: [],
    urlReplacements: rules.redirects,
    ...emptyCanonicalFilters(),

    rules,
    filters,
    enabled: true,
    paused: false,
  };
}
