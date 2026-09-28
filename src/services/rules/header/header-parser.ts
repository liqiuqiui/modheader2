import { isNonEmptyString } from "../../../types/profile/profile-guards";
import type { HeaderRule } from "../../../types/profile/profile-model";
import { isHeaderRule } from "../../../types/profile/profile-validation";

export function normalizeHeaderRule(rule: HeaderRule): HeaderRule {
  return {
    ...rule,
    name: rule.name.trim(),
    value: rule.value,
    comment: rule.comment.trim(),
  };
}

export function parseHeaderRule(input: unknown): HeaderRule | null {
  if (!isHeaderRule(input)) return null;
  if (!isNonEmptyString(input.id)) return null;
  return normalizeHeaderRule(input);
}
