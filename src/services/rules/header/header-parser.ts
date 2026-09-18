import { nanoid } from "nanoid";
import type { HeaderRule } from "../../../types/profile/profile-model";

export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

export function createHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
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

export function isContentSecurityPolicyHeaderName(name: string): boolean {
  return name.trim().toLowerCase() === CONTENT_SECURITY_POLICY_HEADER.toLowerCase();
}

export function isContentSecurityPolicyHeaderRule(rule: HeaderRule): boolean {
  return isContentSecurityPolicyHeaderName(rule.name);
}

export function normalizeHeaderRule(rule: HeaderRule): HeaderRule {
  return {
    ...rule,
    name: rule.name.trim(),
    value: rule.value,
    comment: rule.comment.trim(),
  };
}

export function parseHeaderRule(input: unknown): HeaderRule | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<HeaderRule>;
  if (
    typeof value.id !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.name !== "string" ||
    typeof value.value !== "string" ||
    typeof value.comment !== "string" ||
    (value.appendMode !== "override" &&
      value.appendMode !== "append" &&
      value.appendMode !== "comma") ||
    typeof value.sendEmptyHeader !== "boolean"
  ) {
    return null;
  }
  return normalizeHeaderRule(value as HeaderRule);
}
