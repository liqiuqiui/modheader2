import type { NameValueRule } from "../../../types/profile/profile-model";

export function patchCookieRule(rule: NameValueRule, patch: Partial<NameValueRule>): NameValueRule {
  return { ...rule, ...patch, id: rule.id };
}

export function cloneCookieRule(rule: NameValueRule, cloneId: string): NameValueRule {
  return { ...rule, id: cloneId };
}

export function setCookieRuleEnabled(rule: NameValueRule, enabled: boolean): NameValueRule {
  return rule.enabled === enabled ? rule : { ...rule, enabled };
}
