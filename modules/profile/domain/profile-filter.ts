import { nanoid } from "nanoid";
import type {
  FilterKind,
  FilterMode,
  Profile,
  ProfileFilter,
  ProfileFilterByKind,
  RequestMethod,
  ResourceType,
} from "./profile-model";
import { FILTER_KINDS, FILTER_MODES, REQUEST_METHODS, RESOURCE_TYPES } from "./profile-model";

const FILTER_KIND_SET = new Set<string>(FILTER_KINDS);
const FILTER_MODE_SET = new Set<string>(FILTER_MODES);
const REQUEST_METHOD_SET = new Set<string>(REQUEST_METHODS);
const RESOURCE_TYPE_SET = new Set<string>(RESOURCE_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  if (kind === "tab") {
    return value === null || (Number.isInteger(value) && (value as number) >= 0);
  }
  if (kind === "resourceType") return isResourceType(value);
  if (kind === "method") return isRequestMethod(value);
  return typeof value === "string";
}

export function isProfileFilter(value: unknown): value is ProfileFilter {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.enabled !== "boolean" ||
    !isFilterKind(value.kind) ||
    !isFilterMode(value.mode) ||
    typeof value.comment !== "string"
  ) {
    return false;
  }
  return isFilterValue(value.kind, value.value);
}

export function createProfileFilter<K extends FilterKind>({
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
  if (kind === "tab") {
    const value = Number.isInteger(currentTabId) && currentTabId! >= 0 ? currentTabId! : null;
    return { ...common, kind, value } as ProfileFilterByKind<K>;
  }
  if (kind === "resourceType") {
    return { ...common, kind, value: "xmlhttprequest" } as ProfileFilterByKind<K>;
  }
  if (kind === "method") {
    return { ...common, kind, value: "get" } as ProfileFilterByKind<K>;
  }
  return { ...common, kind, value: "" } as ProfileFilterByKind<K>;
}

export function orderedProfileFilters(profile: Profile): ProfileFilter[] {
  return profile.filters.order.flatMap((filterId) => {
    const filter = profile.filters.byId[filterId];
    return filter ? [filter] : [];
  });
}
