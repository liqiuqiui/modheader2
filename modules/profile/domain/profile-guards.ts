import { isArray, isEmpty, isPlainObject } from "lodash-es";
import type { AppendMode, ProfileRuleCollection } from "./profile-model";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value);
}

export function isArrayOf<Item>(
  value: unknown,
  isItem: (value: unknown) => value is Item,
): value is Item[] {
  return isArray(value) && value.every(isItem);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && !isEmpty(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isAppendMode(value: unknown): value is AppendMode {
  return value === "override" || value === "append" || value === "comma";
}

export function isProfileRuleCollection(value: unknown): value is ProfileRuleCollection {
  return (
    value === "headers" ||
    value === "respHeaders" ||
    value === "csp" ||
    value === "cookies" ||
    value === "urlReplacements"
  );
}

export function isOrderedEntityRecord<Entity extends { id: string }>(
  byId: Record<string, unknown>,
  order: string[],
  isEntity: (value: unknown) => value is Entity,
): byId is Record<string, Entity> {
  const entityIds = Object.keys(byId);
  return (
    entityIds.length === order.length &&
    new Set(order).size === order.length &&
    entityIds.every((entityId) => {
      const entity = byId[entityId];
      return isEntity(entity) && entity.id === entityId;
    }) &&
    order.every((entityId) => Object.hasOwn(byId, entityId))
  );
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}
