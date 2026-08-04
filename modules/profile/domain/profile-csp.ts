import type { HeaderRule } from "./profile-model";

export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

export function isContentSecurityPolicyHeaderName(name: string): boolean {
  return name.trim().toLowerCase() === CONTENT_SECURITY_POLICY_HEADER.toLowerCase();
}

export function isContentSecurityPolicyRule(rule: HeaderRule): boolean {
  return isContentSecurityPolicyHeaderName(rule.name);
}

export function isCspDirectiveRule(rule: HeaderRule): boolean {
  return isContentSecurityPolicyRule(rule) && rule.cspMode === "directive";
}

export function splitCspDirective(value: string): {
  directive: string;
  directiveValue: string;
} {
  const tabIndex = value.indexOf("\t");
  if (tabIndex >= 0) {
    return {
      directive: value.slice(0, tabIndex).trim(),
      directiveValue: value.slice(tabIndex + 1),
    };
  }
  const normalized = value.trimStart();
  const separatorIndex = normalized.search(/\s/);
  if (separatorIndex < 0) return { directive: normalized, directiveValue: "" };
  return {
    directive: normalized.slice(0, separatorIndex),
    directiveValue: normalized.slice(separatorIndex).trimStart(),
  };
}

export function joinCspDirective(directive: string, directiveValue: string): string {
  const normalizedDirective = directive.trim();
  if (!normalizedDirective && !directiveValue) return "";
  return `${normalizedDirective}\t${directiveValue.trimStart()}`;
}

export function createCspDirectiveValue(rule: HeaderRule): string {
  const { directive, directiveValue } = splitCspDirective(rule.value);
  if (!directive) return "";
  const normalizedValue = directiveValue.trim();
  return `${directive}${normalizedValue ? ` ${normalizedValue}` : ""}`.replace(/;+\s*$/, "").trim();
}

export function createContentSecurityPolicyValue(rules: HeaderRule[]): string {
  return rules
    .filter((rule) => rule.enabled && isCspDirectiveRule(rule))
    .map(createCspDirectiveValue)
    .filter(Boolean)
    .join("; ");
}
