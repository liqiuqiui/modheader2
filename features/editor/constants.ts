import type { ParseKeys } from "i18next";
import {
  REQUEST_METHODS,
  RESOURCE_TYPES as PROFILE_RESOURCE_TYPES,
  type FilterKind,
  type RequestMethod,
  type ResourceType,
} from "../../modules/profile/domain/profile-model";

export const FILTER_LABEL_KEYS: Record<FilterKind, ParseKeys> = {
  urlPattern: "filter.urlPattern",
  urlRegex: "filter.urlRegex",
  tab: "filter.tab",
  resourceType: "filter.resourceType",
  method: "filter.method",
  initiator: "filter.initiator",
};

const RESOURCE_LABEL_KEYS: Record<ResourceType, ParseKeys> = {
  main_frame: "resource.mainFrame",
  sub_frame: "resource.subFrame",
  xmlhttprequest: "resource.xhr",
  script: "resource.script",
  stylesheet: "resource.stylesheet",
  image: "resource.image",
  font: "resource.font",
  media: "resource.media",
  object: "resource.object",
  other: "resource.other",
};

export const RESOURCE_TYPES = PROFILE_RESOURCE_TYPES.map(
  (resourceType) => [resourceType, RESOURCE_LABEL_KEYS[resourceType]] as const,
);

const METHOD_ORDER: Record<RequestMethod, number> = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
  head: 5,
  options: 6,
  connect: 7,
};

export const METHODS = [...REQUEST_METHODS].sort(
  (left, right) => METHOD_ORDER[left] - METHOD_ORDER[right],
);

export const SIDEBAR_COLLAPSED_KEY = "modheader-v2:sidebar-collapsed";
