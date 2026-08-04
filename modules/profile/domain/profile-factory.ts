import { nanoid } from "nanoid";
import {
  getProfileShortTitle,
  getProfileTextColor,
  randomProfileColor,
} from "./profile-appearance";
import { CONTENT_SECURITY_POLICY_HEADER } from "./profile-csp";
import type { CookieRule, HeaderRule, Profile, UrlReplacement } from "./profile-model";

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

export function createCspRule(overrides?: Partial<HeaderRule>): HeaderRule {
  return createHeaderRule({
    ...overrides,
    name: CONTENT_SECURITY_POLICY_HEADER,
    cspMode: "directive",
  });
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

export function createProfile({
  title,
  shortTitle = getProfileShortTitle(title),
  backgroundColor = randomProfileColor(),
  id = nanoid(),
}: {
  title: string;
  shortTitle?: string;
  backgroundColor?: string;
  id?: string;
}): Profile {
  return {
    id,
    title,
    shortTitle,
    backgroundColor,
    textColor: getProfileTextColor(backgroundColor),
    enabled: true,
    paused: false,
    hideComment: true,
    headers: [createHeaderRule()],
    respHeaders: [],
    cookies: [],
    urlReplacements: [],
    filters: { byId: {}, order: [] },
  };
}
