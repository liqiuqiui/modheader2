import { nanoid } from "nanoid";
import { randomProfileColor } from "./profile-appearance";
import type { CspRule, HeaderRule, NameValueRule, Profile } from "./profile-model";

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

export function createRedirectRule(overrides?: Partial<NameValueRule>): NameValueRule {
  return createNameValueRule(overrides);
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
  return {
    id,
    title,
    backgroundColor,
    enabled: true,
    paused: false,
    rules: {
      requestHeaders: [createHeaderRule()],
      responseHeaders: [],
      csp: [],
      cookies: [],
      redirects: [],
    },
    filters: [],
  };
}
