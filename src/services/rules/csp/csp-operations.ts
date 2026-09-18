import type { CspRule } from "../../../types/profile/profile-model";
import { createCspDirectiveValue } from "./csp-parser";

export function patchCspRule(rule: CspRule, patch: Partial<CspRule>): CspRule {
  return { ...rule, ...patch, id: rule.id };
}

export function cloneCspRule(rule: CspRule, cloneId: string): CspRule {
  return { ...rule, id: cloneId };
}

export function setCspRuleEnabled(rule: CspRule, enabled: boolean): CspRule {
  return rule.enabled === enabled ? rule : { ...rule, enabled };
}

export function cspRuleValue(rule: CspRule): string {
  return createCspDirectiveValue(rule);
}
