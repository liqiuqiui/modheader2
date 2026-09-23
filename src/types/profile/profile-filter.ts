import { nanoid } from "nanoid";
import type {
  FilterKind,
  FilterMode,
  ProfileFilter,
  ProfileFilterByKind,
  RequestMethod,
  ResourceType,
} from "./profile-model";
import { FILTER_KINDS, FILTER_MODES, REQUEST_METHODS, RESOURCE_TYPES } from "./profile-model";
import { hasExactKeys, isNonEmptyString, isNonNegativeInteger, isRecord } from "./profile-guards";

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
  if (kind === "tab" || kind === "tabGroup" || kind === "window") {
    return value === null || isNonNegativeInteger(value);
  }
  if (kind === "resourceType") return isResourceType(value);
  if (kind === "method") return isRequestMethod(value);
  if (kind === "time") return isNonNegativeInteger(value);
  return typeof value === "string";
}

export function isProfileFilter(value: unknown): value is ProfileFilter {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["id", "enabled", "kind", "mode", "value", "comment"]) ||
    !isNonEmptyString(value.id) ||
    typeof value.enabled !== "boolean" ||
    !isFilterKind(value.kind) ||
    !isFilterMode(value.mode) ||
    typeof value.comment !== "string"
  ) {
    return false;
  }
  return isFilterValue(value.kind, value.value);
}

/**
 * 创建或切换过滤器类型时用于推导默认取值范围的上下文。
 * 只有 `tab` 用 Tab ID，`tabGroup` / `window` 必须取所在分组/窗口的 ID，
 * 否则默认值永远匹配不到真实目标（会被显示为「已关闭」）。
 */
export interface FilterTarget {
  currentTabId?: number;
  groupId?: number;
  windowId?: number;
}

export function createProfileFilter<K extends FilterKind>({
  kind,
  mode = "include",
  currentTabId,
  groupId,
  windowId,
  id = nanoid(),
}: {
  kind: K;
  mode?: FilterMode;
  id?: string;
} & FilterTarget): ProfileFilterByKind<K> {
  const common = { id, enabled: true, mode, comment: "" };
  if (kind === "tab") {
    const value = isNonNegativeInteger(currentTabId) ? currentTabId : null;
    return { ...common, kind, value } as ProfileFilterByKind<K>;
  }
  if (kind === "tabGroup") {
    // `groupId` is TAB_GROUP_ID_NONE (-1) for ungrouped tabs.
    const value = isNonNegativeInteger(groupId) ? groupId : null;
    return { ...common, kind, value } as ProfileFilterByKind<K>;
  }
  if (kind === "window") {
    const value = isNonNegativeInteger(windowId) ? windowId : null;
    return { ...common, kind, value } as ProfileFilterByKind<K>;
  }
  if (kind === "resourceType") {
    return { ...common, kind, value: "xmlhttprequest" } as ProfileFilterByKind<K>;
  }
  if (kind === "method") {
    return { ...common, kind, value: "get" } as ProfileFilterByKind<K>;
  }
  if (kind === "time") {
    return { ...common, kind, value: Date.now() + 60 * 60 * 1000 } as ProfileFilterByKind<K>;
  }
  return { ...common, kind, value: "" } as ProfileFilterByKind<K>;
}
