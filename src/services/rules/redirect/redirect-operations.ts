import type { UrlReplacementRule } from "../../../types/profile/profile-model";

export function patchRedirectRule(
  rule: UrlReplacementRule,
  patch: Partial<UrlReplacementRule>,
): UrlReplacementRule {
  return { ...rule, ...patch, id: rule.id };
}

export function cloneRedirectRule(rule: UrlReplacementRule, cloneId: string): UrlReplacementRule {
  return { ...rule, id: cloneId };
}

export function setRedirectRuleEnabled(
  rule: UrlReplacementRule,
  enabled: boolean,
): UrlReplacementRule {
  return rule.enabled === enabled ? rule : { ...rule, enabled };
}
