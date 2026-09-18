import type { HeaderRule } from "../../../types/profile/profile-model";
import { normalizeHeaderRule } from "./header-parser";

export function patchHeaderRule(rule: HeaderRule, patch: Partial<HeaderRule>): HeaderRule {
  return normalizeHeaderRule({ ...rule, ...patch, id: rule.id });
}

export function cloneHeaderRule(rule: HeaderRule, cloneId: string): HeaderRule {
  return { ...rule, id: cloneId };
}

export function setHeaderRuleEnabled(rule: HeaderRule, enabled: boolean): HeaderRule {
  return rule.enabled === enabled ? rule : { ...rule, enabled };
}
