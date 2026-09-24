import type { HeaderRule } from "../../../types/profile/profile-model";

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
