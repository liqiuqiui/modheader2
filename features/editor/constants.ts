import type { ParseKeys } from "i18next";
import type { RequestMethod } from "../../types";
import type { FilterKind } from "./types";

export const FILTER_LABEL_KEYS: Record<FilterKind, ParseKeys> = {
  urlPattern: "filter.urlPattern",
  urlRegex: "filter.urlRegex",
  tab: "filter.tab",
  resourceType: "filter.resourceType",
  method: "filter.method",
  initiator: "filter.initiator",
};

export const RESOURCE_TYPES = [
  ["main_frame", "resource.mainFrame"],
  ["sub_frame", "resource.subFrame"],
  ["xmlhttprequest", "resource.xhr"],
  ["script", "resource.script"],
  ["stylesheet", "resource.stylesheet"],
  ["image", "resource.image"],
  ["font", "resource.font"],
  ["media", "resource.media"],
  ["object", "resource.object"],
  ["other", "resource.other"],
] as const;

export const METHODS: RequestMethod[] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "connect",
];

export const SIDEBAR_COLLAPSED_KEY = "modheader-v2:sidebar-collapsed";
