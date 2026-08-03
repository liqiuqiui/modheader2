import type { Profile } from "../../types";
import type { FilterView } from "./types";

export function profileFilters(profile: Profile): FilterView[] {
  return [
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
}
