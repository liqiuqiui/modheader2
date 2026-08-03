import type { Profile } from "../../types";
import type { FilterView } from "./types";

export function profileFilters(profile: Profile): FilterView[] {
  const filters = [
    ...(profile.urlFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: filter.matchType === "regex" ? "urlRegex" : "urlPattern",
        mode: "include",
        value: filter.urlRegex,
        comment: filter.comment,
      }),
    ),
    ...(profile.excludeUrlFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: filter.matchType === "regex" ? "urlRegex" : "urlPattern",
        mode: "exclude",
        value: filter.urlRegex,
        comment: filter.comment,
      }),
    ),
    ...(profile.tabFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: "tab",
        mode: filter.exclude ? "exclude" : "include",
        value: filter.tabId,
        comment: filter.comment,
      }),
    ),
    ...(profile.resourceFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: "resourceType",
        mode: filter.exclude ? "exclude" : "include",
        value: filter.resourceType[0] ?? "xmlhttprequest",
        comment: filter.comment,
      }),
    ),
    ...(profile.methodFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: "method",
        mode: filter.exclude ? "exclude" : "include",
        value: filter.method,
        comment: filter.comment,
      }),
    ),
    ...(profile.initiatorDomainFilters ?? []).map(
      (filter): FilterView => ({
        id: filter.id,
        enabled: filter.enabled,
        kind: "initiator",
        mode: filter.exclude ? "exclude" : "include",
        value: filter.domain,
        comment: filter.comment,
      }),
    ),
  ];

  if (profile.filterOrder.length === 0) return filters;
  const filtersById = new Map(filters.map((filter) => [filter.id, filter]));
  const orderedIds = new Set<string>();
  const ordered = profile.filterOrder.flatMap((id) => {
    const filter = filtersById.get(id);
    if (!filter || orderedIds.has(id)) return [];
    orderedIds.add(id);
    return [filter];
  });

  return [...ordered, ...filters.filter((filter) => !orderedIds.has(filter.id))];
}
