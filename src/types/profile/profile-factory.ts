import { nanoid } from "nanoid";
import {
  getProfileShortTitle,
  getProfileTextColor,
  isProfileBackgroundColor,
  randomProfileColor,
} from "./profile-appearance";
import { isNonEmptyString } from "./profile-guards";
import type {
  CspRule,
  HeaderRule,
  NameValueRule,
  Profile,
  ProfileFilter,
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

function createEditorRules(): ProfileRules {
  return {
    requestHeaders: [createHeaderRule()],
    responseHeaders: [],
    csp: [],
    cookies: [],
    redirects: [],
  };
}

function createEditorFilters(): ProfileFilter[] {
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
  if (!title) throw new Error("Profile title is required");
  if (!isNonEmptyString(id)) throw new Error("Profile id is required");
  if (!isProfileBackgroundColor(backgroundColor)) {
    throw new Error("Profile background color must be a hex color");
  }
  const rules = createEditorRules();
  const filters = createEditorFilters();
  return {
    version: 1,
    id,
    title,
    shortTitle: getProfileShortTitle(title),
    backgroundColor,
    textColor: getProfileTextColor(backgroundColor),
    hideComment: true,
    rules,
    filters,
    enabled: true,
    paused: false,
  };
}
