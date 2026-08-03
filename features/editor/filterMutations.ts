import {
  createDomainFilter,
  createMethodFilter,
  createResourceFilter,
  createTabFilter,
  createUrlFilter,
} from "../../types";
import { arrayMoveImmutable } from "array-move";
import type { Profile, RequestMethod } from "../../types";
import type { BrowserTab } from "../../types/browser";
import type { FilterKind, FilterMode, FilterView } from "./types";

export type FilterCollectionsPatch = Pick<
  Profile,
  | "urlFilters"
  | "excludeUrlFilters"
  | "tabFilters"
  | "resourceFilters"
  | "methodFilters"
  | "initiatorDomainFilters"
  | "filterOrder"
>;

export function withoutFilter(profile: Profile, id: string): FilterCollectionsPatch {
  return {
    urlFilters: profile.urlFilters.filter((filter) => filter.id !== id),
    excludeUrlFilters: profile.excludeUrlFilters.filter((filter) => filter.id !== id),
    tabFilters: profile.tabFilters.filter((filter) => filter.id !== id),
    resourceFilters: profile.resourceFilters.filter((filter) => filter.id !== id),
    methodFilters: profile.methodFilters.filter((filter) => filter.id !== id),
    initiatorDomainFilters: profile.initiatorDomainFilters.filter((filter) => filter.id !== id),
    filterOrder: profile.filterOrder,
  };
}

export function deleteFilter(profile: Profile, id: string): FilterCollectionsPatch {
  return {
    ...withoutFilter(profile, id),
    filterOrder: profile.filterOrder.filter((filterId) => filterId !== id),
  };
}

export function reorderFilters(
  filters: FilterView[],
  fromIndex: number,
  toIndex: number,
): Pick<Profile, "filterOrder"> {
  return {
    filterOrder: arrayMoveImmutable(filters, fromIndex, toIndex).map((filter) => filter.id),
  };
}

export function addFilter(
  profile: Profile,
  tabs: BrowserTab[],
  kind: FilterKind,
  mode: FilterMode,
  currentTabId?: number,
): { patch: Partial<Profile>; focusId?: string } {
  if (kind === "urlPattern" || kind === "urlRegex") {
    const filter = createUrlFilter({ matchType: kind === "urlRegex" ? "regex" : "pattern" });
    return {
      patch:
        mode === "exclude"
          ? { excludeUrlFilters: [...profile.excludeUrlFilters, filter] }
          : { urlFilters: [...profile.urlFilters, filter] },
      focusId: filter.id,
    };
  }

  const activeTabId =
    tabs.find((tab) => tab.id === currentTabId)?.id ?? tabs.find((tab) => tab.active)?.id ?? "";
  if (kind === "tab") {
    return {
      patch: {
        tabFilters: [
          ...profile.tabFilters,
          createTabFilter({ tabId: activeTabId, exclude: mode === "exclude" }),
        ],
      },
    };
  }
  if (kind === "resourceType") {
    return {
      patch: {
        resourceFilters: [
          ...profile.resourceFilters,
          createResourceFilter({ exclude: mode === "exclude" }),
        ],
      },
    };
  }
  if (kind === "method") {
    return {
      patch: {
        methodFilters: [
          ...profile.methodFilters,
          createMethodFilter({ exclude: mode === "exclude" }),
        ],
      },
    };
  }
  return {
    patch: {
      initiatorDomainFilters: [
        ...profile.initiatorDomainFilters,
        createDomainFilter({ exclude: mode === "exclude" }),
      ],
    },
  };
}

export function updateFilter(
  profile: Profile,
  filter: FilterView,
  patch: Partial<FilterView>,
): Partial<Profile> {
  const next = { ...filter, ...patch };
  if (patch.kind && patch.kind !== filter.kind) return {};

  if (filter.kind === "urlPattern" || filter.kind === "urlRegex") {
    const source = filter.mode === "include" ? profile.urlFilters : profile.excludeUrlFilters;
    const updated = source.map((item) =>
      item.id === filter.id
        ? {
            ...item,
            enabled: next.enabled,
            urlRegex: String(next.value),
            matchType: next.kind === "urlRegex" ? ("regex" as const) : ("pattern" as const),
          }
        : item,
    );
    if (next.mode === filter.mode) {
      return filter.mode === "include" ? { urlFilters: updated } : { excludeUrlFilters: updated };
    }
    const moved = updated.find((item) => item.id === filter.id);
    if (!moved) return {};
    const collections = withoutFilter(profile, filter.id);
    if (next.mode === "include") collections.urlFilters.push(moved);
    else collections.excludeUrlFilters.push(moved);
    return collections;
  }

  if (filter.kind === "tab") {
    return {
      tabFilters: profile.tabFilters.map((item) =>
        item.id === filter.id
          ? { ...item, enabled: next.enabled, tabId: next.value, exclude: next.mode === "exclude" }
          : item,
      ),
    };
  }
  if (filter.kind === "resourceType") {
    return {
      resourceFilters: profile.resourceFilters.map((item) =>
        item.id === filter.id
          ? {
              ...item,
              enabled: next.enabled,
              resourceType: [String(next.value)],
              exclude: next.mode === "exclude",
            }
          : item,
      ),
    };
  }
  if (filter.kind === "method") {
    return {
      methodFilters: profile.methodFilters.map((item) =>
        item.id === filter.id
          ? {
              ...item,
              enabled: next.enabled,
              method: String(next.value) as RequestMethod,
              exclude: next.mode === "exclude",
            }
          : item,
      ),
    };
  }
  return {
    initiatorDomainFilters: profile.initiatorDomainFilters.map((item) =>
      item.id === filter.id
        ? {
            ...item,
            enabled: next.enabled,
            domain: String(next.value),
            exclude: next.mode === "exclude",
          }
        : item,
    ),
  };
}

export function changeFilterKind(
  profile: Profile,
  tabs: BrowserTab[],
  filter: FilterView,
  kind: FilterKind,
  currentTabId?: number,
): Partial<Profile> {
  if (kind === filter.kind) return {};
  const collections = withoutFilter(profile, filter.id);
  const common = { id: filter.id, enabled: filter.enabled, comment: filter.comment };

  if (kind === "urlPattern" || kind === "urlRegex") {
    const next = createUrlFilter({
      ...common,
      matchType: kind === "urlRegex" ? "regex" : "pattern",
    });
    if (filter.mode === "exclude") collections.excludeUrlFilters.push(next);
    else collections.urlFilters.push(next);
  } else if (kind === "tab") {
    collections.tabFilters.push(
      createTabFilter({
        ...common,
        tabId:
          tabs.find((tab) => tab.id === currentTabId)?.id ??
          tabs.find((tab) => tab.active)?.id ??
          "",
        exclude: filter.mode === "exclude",
      }),
    );
  } else if (kind === "resourceType") {
    collections.resourceFilters.push(
      createResourceFilter({ ...common, exclude: filter.mode === "exclude" }),
    );
  } else if (kind === "method") {
    collections.methodFilters.push(
      createMethodFilter({ ...common, exclude: filter.mode === "exclude" }),
    );
  } else {
    collections.initiatorDomainFilters.push(
      createDomainFilter({ ...common, exclude: filter.mode === "exclude" }),
    );
  }
  return collections;
}

export function setAllFiltersEnabled(profile: Profile, enabled: boolean): FilterCollectionsPatch {
  return {
    urlFilters: profile.urlFilters.map((filter) => ({ ...filter, enabled })),
    excludeUrlFilters: profile.excludeUrlFilters.map((filter) => ({ ...filter, enabled })),
    tabFilters: profile.tabFilters.map((filter) => ({ ...filter, enabled })),
    resourceFilters: profile.resourceFilters.map((filter) => ({ ...filter, enabled })),
    methodFilters: profile.methodFilters.map((filter) => ({ ...filter, enabled })),
    initiatorDomainFilters: profile.initiatorDomainFilters.map((filter) => ({
      ...filter,
      enabled,
    })),
    filterOrder: profile.filterOrder,
  };
}

export function clearFilters(): FilterCollectionsPatch {
  return {
    urlFilters: [],
    excludeUrlFilters: [],
    tabFilters: [],
    resourceFilters: [],
    methodFilters: [],
    initiatorDomainFilters: [],
    filterOrder: [],
  };
}
