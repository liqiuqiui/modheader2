import { isPlainObject } from "lodash-es";
import type { AppendMode, ProfileRuleCollection } from "./profile-model";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

export function isArrayOf<Item>(
  value: unknown,
  isItem: (value: unknown) => value is Item,
): value is Item[] {
  return Array.isArray(value) && value.every(isItem);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isAppendMode(value: unknown): value is AppendMode {
  return value === "override" || value === "append" || value === "comma";
}

export function isProfileRuleCollection(value: unknown): value is ProfileRuleCollection {
  return (
    value === "requestHeaders" ||
    value === "responseHeaders" ||
    value === "csp" ||
    value === "cookies" ||
    value === "redirects"
  );
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key));
}
