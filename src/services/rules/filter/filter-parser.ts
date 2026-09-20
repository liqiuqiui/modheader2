import { nanoid } from "nanoid";
import type {
  FilterKind,
  FilterMode,
  ProfileFilter,
  ProfileFilterByKind,
  RequestMethod,
  ResourceType,
} from "../../../types/profile/profile-model";
import {
  FILTER_KINDS,
  FILTER_MODES,
  REQUEST_METHODS,
  RESOURCE_TYPES,
} from "../../../types/profile/profile-model";

const FILTER_KIND_SET = new Set<string>(FILTER_KINDS);
const FILTER_MODE_SET = new Set<string>(FILTER_MODES);
const REQUEST_METHOD_SET = new Set<string>(REQUEST_METHODS);
const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES);

export function isRequestMethod(value: unknown): value is RequestMethod {
  return typeof value === "string" && REQUEST_METHOD_SET.has(value);
}

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && RESOURCE_TYPE_SET.has(value);
}

export function isFilterKind(value: unknown): value is FilterKind {
  return typeof value === "string" && FILTER_KIND_SET.has(value);
}

export function isFilterMode(value: unknown): value is FilterMode {
  return typeof value === "string" && FILTER_MODE_SET.has(value);
}

export function isFilterValue(kind: FilterKind, value: unknown): value is ProfileFilter["value"] {
  if (kind === "tab" || kind === "tabGroup" || kind === "window")
    return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);
  if (kind === "resourceType") return isResourceType(value);
  if (kind === "method") return isRequestMethod(value);
  if (kind === "time") {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  }
  return typeof value === "string";
}

export function parseFilter(input: unknown): ProfileFilter | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<ProfileFilter>;
  if (
    typeof value.id !== "string" ||
    typeof value.enabled !== "boolean" ||
    !isFilterKind(value.kind) ||
    !isFilterMode(value.mode) ||
    typeof value.comment !== "string" ||
    !isFilterValue(value.kind, value.value)
  ) {
    return null;
  }
  return {
    ...value,
    id: value.id,
    kind: value.kind,
    mode: value.mode,
    value: value.value,
    comment: value.comment.trim(),
  } as ProfileFilter;
}

export function createFilter<K extends FilterKind>({
  kind,
  mode = "include",
  currentTabId,
  id = nanoid(),
}: {
  kind: K;
  mode?: FilterMode;
  currentTabId?: number;
  id?: string;
}): ProfileFilterByKind<K> {
  const common = { id, enabled: true, mode, comment: "" };
  if (kind === "tab" || kind === "tabGroup" || kind === "window") {
    const value =
      typeof currentTabId === "number" && Number.isInteger(currentTabId) && currentTabId >= 0
        ? currentTabId
        : null;
    return { ...common, kind, value } as ProfileFilterByKind<K>;
  }
  if (kind === "resourceType")
    return { ...common, kind, value: "xmlhttprequest" } as ProfileFilterByKind<K>;
  if (kind === "method") return { ...common, kind, value: "get" } as ProfileFilterByKind<K>;
  if (kind === "time") {
    return { ...common, kind, value: Date.now() + 60 * 60 * 1000 } as ProfileFilterByKind<K>;
  }
  return { ...common, kind, value: "" } as ProfileFilterByKind<K>;
}
