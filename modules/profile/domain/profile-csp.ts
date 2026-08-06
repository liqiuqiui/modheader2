import type { CspRule, HeaderRule } from "./profile-model";

export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

export function isContentSecurityPolicyHeaderName(name: string): boolean {
  return name.trim().toLowerCase() === CONTENT_SECURITY_POLICY_HEADER.toLowerCase();
}

export function isContentSecurityPolicyHeaderRule(rule: HeaderRule): boolean {
  return isContentSecurityPolicyHeaderName(rule.name);
}

export function splitCspDirective(input: string): { directive: string; value: string } {
  const tabIndex = input.indexOf("\t");
  if (tabIndex >= 0) {
    return {
      directive: input.slice(0, tabIndex).trim(),
      value: input.slice(tabIndex + 1).trimStart(),
    };
  }

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

export function cspRuleFromHeaderRule(rule: HeaderRule): CspRule {
  const { directive, value } = splitCspDirective(rule.value);
  return {
    id: rule.id,
    enabled: rule.enabled,
    directive,
    value,
    comment: rule.comment,
  };
}

export function headerRuleFromCspRule(rule: CspRule): HeaderRule {
  return {
    id: rule.id,
    enabled: rule.enabled,
    name: CONTENT_SECURITY_POLICY_HEADER,
    value: createCspDirectiveValue(rule),
    comment: rule.comment,
    appendMode: "override",
    sendEmptyHeader: false,
  };
}

export function createCspDirectiveValue(rule: CspRule): string {
  if (!rule.directive.trim()) return "";
  const joined = joinCspDirective(rule.directive, rule.value);
  return joined.replace(/;+\s*$/, "").trim();
}

export function createContentSecurityPolicyValue(rules: CspRule[]): string {
  return rules
    .filter((rule) => rule.enabled)
    .map(createCspDirectiveValue)
    .filter(Boolean)
    .join("; ");
}
