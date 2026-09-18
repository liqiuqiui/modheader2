import { nanoid } from "nanoid";
import type { CspRule } from "../../../types/profile/profile-model";

export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

export function createCspRule(overrides: Partial<CspRule> = {}): CspRule {
  return {
    id: nanoid(),
    enabled: true,
    directive: "",
    value: "",
    comment: "",
    ...overrides,
  };
}

export function splitCspDirective(input: string): { directive: string; value: string } {
  const normalized = input.trimStart();
  const separatorIndex = normalized.search(/\s/);
  if (separatorIndex < 0) return { directive: normalized, value: "" };
  return {
    directive: normalized.slice(0, separatorIndex),
    value: normalized.slice(separatorIndex).trimStart(),
  };
}

export function joinCspDirective(directive: string, value: string): string {
  const normalizedDirective = directive.trim();
  const normalizedValue = value.trimStart();
  if (!normalizedDirective) return normalizedValue;
  return `${normalizedDirective}${normalizedValue ? ` ${normalizedValue}` : ""}`;
}

export function createCspDirectiveValue(rule: CspRule): string {
  if (!rule.directive.trim()) return "";
  return joinCspDirective(rule.directive, rule.value).replace(/;\s*$/, "").trim();
}
