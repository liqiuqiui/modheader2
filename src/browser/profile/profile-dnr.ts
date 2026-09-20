import { isEmpty, isNil, uniq } from "lodash-es";
import { browser, type Browser } from "wxt/browser";
import {
  CONTENT_SECURITY_POLICY_HEADER,
  createCspDirectiveValue,
  createContentSecurityPolicyValue,
} from "../../types/profile/profile-csp";
import { isNonNegativeInteger } from "../../types/profile/profile-guards";
import type {
  CspRule,
  HeaderRule,
  NameValueRule,
  Profile,
  ProfileFilter,
} from "../../types/profile/profile-model";

export const PROFILE_DNR_RULE_ID_BASE = 10000;
export const MAX_PROFILE_DNR_RULES = 100;

export type ProfileDnrRule = Browser.declarativeNetRequest.Rule;

export interface ProfileDnrCompilation {
  rules: ProfileDnrRule[];
  diagnostics: string[];
}

type DnrCondition = Browser.declarativeNetRequest.RuleCondition;
type HeaderOperation = "append" | "set";
type PendingProfileDnrRule = Omit<ProfileDnrRule, "id" | "priority">;
type UrlProfileFilter = Extract<ProfileFilter, { kind: "urlPattern" } | { kind: "urlRegex" }>;

export interface ProfileDnrCompileOptions {
  tabs?: Array<Pick<Browser.tabs.Tab, "id" | "groupId" | "windowId">>;
}

const MANAGED_PROFILE_RULE_IDS = Array.from(
  { length: MAX_PROFILE_DNR_RULES },
  (_, index) => PROFILE_DNR_RULE_ID_BASE + index,
);

function failedCompilation(message: string): ProfileDnrCompilation {
  return { rules: [], diagnostics: [message] };
}

function isAscii(value: string): boolean {
  return Array.from(value).every((character) => character.codePointAt(0)! <= 0x7f);
}

function isJavascriptRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

function isDomain(value: string): boolean {
  if (!value || !isAscii(value) || value.length > 253) return false;
  return value
    .split(".")
    .every(
      (label) =>
        label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
}

function appendModeToOperation(rule: HeaderRule): HeaderOperation {
  return rule.appendMode === "append" || rule.appendMode === "comma" ? "append" : "set";
}

function isEffectiveHeaderRule(rule: HeaderRule): boolean {
  return Boolean(rule.enabled && rule.name.trim() && (rule.value || rule.sendEmptyHeader));
}

function isEffectiveCspRule(rule: CspRule): boolean {
  return Boolean(rule.enabled && rule.directive.trim() && createCspDirectiveValue(rule));
}

function isEffectiveCookieRule(cookie: NameValueRule): boolean {
  return Boolean(cookie.enabled && cookie.name.trim());
}

function isEffectiveRedirectRule(replacement: NameValueRule): boolean {
  return Boolean(replacement.enabled && replacement.name.trim() && replacement.value.trim());
}

export function countEnabledProfileModifications(profile?: Profile): number {
  if (!profile?.enabled || profile.paused) return 0;

  return (
    profile.rules.requestHeaders.filter(isEffectiveHeaderRule).length +
    profile.rules.responseHeaders.filter(isEffectiveHeaderRule).length +
    profile.rules.csp.filter(isEffectiveCspRule).length +
    profile.rules.cookies.filter(isEffectiveCookieRule).length +
    profile.rules.redirects.filter(isEffectiveRedirectRule).length
  );
}

function activeFilters(profile: Profile): ProfileFilter[] {
  return profile.filters.filter(
    (filter) =>
      filter.enabled &&
      !isNil(filter.value) &&
      (typeof filter.value !== "string" || !isEmpty(filter.value.trim())) &&
      filter.kind !== "time",
  );
}

function hasActiveTimeFilters(profile: Profile, now = Date.now()): boolean {
  return profile.filters
    .filter(
      (filter): filter is Extract<ProfileFilter, { kind: "time" }> =>
        filter.enabled && filter.kind === "time",
    )
    .every((filter) => filter.value > now);
}

export function nextProfileTimeFilterExpiration(
  profile?: Profile,
  now = Date.now(),
): number | null {
  if (!profile) return null;
  const future = profile.filters
    .filter(
      (filter): filter is Extract<ProfileFilter, { kind: "time" }> =>
        filter.enabled && filter.kind === "time" && filter.value > now,
    )
    .map((filter) => filter.value);
  return future.length > 0 ? Math.min(...future) : null;
}

function compileProfileCondition(
  filters: ProfileFilter[],
  options: ProfileDnrCompileOptions,
): { condition: DnrCondition } | { error: string } {
  const condition: DnrCondition = {};

  const resourceTypeFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "resourceType" }> =>
      filter.kind === "resourceType",
  );
  const includedResources = uniq(
    resourceTypeFilters.filter((filter) => filter.mode === "include").map((filter) => filter.value),
  );
  const excludedResources = new Set(
    resourceTypeFilters.filter((filter) => filter.mode === "exclude").map((filter) => filter.value),
  );
  if (includedResources.length > 0) {
    const resourceTypes = includedResources.filter((type) => !excludedResources.has(type));
    if (resourceTypes.length === 0) {
      return { error: "Resource filters exclude every included resource type" };
    }
    condition.resourceTypes = resourceTypes as Browser.declarativeNetRequest.ResourceType[];
  } else if (excludedResources.size > 0) {
    condition.excludedResourceTypes = [
      ...excludedResources,
    ] as Browser.declarativeNetRequest.ResourceType[];
  }

  const requestMethodFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "method" }> => filter.kind === "method",
  );
  const includedMethods = uniq(
    requestMethodFilters
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value),
  );
  const excludedMethods = new Set(
    requestMethodFilters
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value),
  );
  if (includedMethods.length > 0) {
    const requestMethods = includedMethods.filter((method) => !excludedMethods.has(method));
    if (requestMethods.length === 0) {
      return { error: "Method filters exclude every included request method" };
    }
    condition.requestMethods = requestMethods as Browser.declarativeNetRequest.RequestMethod[];
  } else if (excludedMethods.size > 0) {
    condition.excludedRequestMethods = [
      ...excludedMethods,
    ] as Browser.declarativeNetRequest.RequestMethod[];
  }

  const tabIdFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "tab" }> => filter.kind === "tab",
  );
  if (tabIdFilters.some((filter) => filter.value === null || !isNonNegativeInteger(filter.value))) {
    return { error: "An enabled tab filter has no valid tab" };
  }
  const includedTabIds = uniq(
    tabIdFilters
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value as number),
  );
  const excludedTabIds = uniq(
    tabIdFilters
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value as number),
  );
  if (includedTabIds.length > 0) condition.tabIds = includedTabIds;
  if (excludedTabIds.length > 0) condition.excludedTabIds = excludedTabIds;

  const tabGroupFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "tabGroup" }> => filter.kind === "tabGroup",
  );
  const windowFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "window" }> => filter.kind === "window",
  );
  const tabs = options.tabs ?? [];
  const tabIdsFor = (kind: "tabGroup" | "window", value: number): number[] =>
    tabs
      .filter((tab) => (kind === "tabGroup" ? tab.groupId === value : tab.windowId === value))
      .flatMap((tab) => (isNonNegativeInteger(tab.id) ? [tab.id] : []));
  const includeScopedTabIds = [
    ...tabGroupFilters
      .filter((filter) => filter.mode === "include")
      .flatMap((filter) => (filter.value === null ? [] : tabIdsFor("tabGroup", filter.value))),
    ...windowFilters
      .filter((filter) => filter.mode === "include")
      .flatMap((filter) => (filter.value === null ? [] : tabIdsFor("window", filter.value))),
  ];
  const excludeScopedTabIds = [
    ...tabGroupFilters
      .filter((filter) => filter.mode === "exclude")
      .flatMap((filter) => (filter.value === null ? [] : tabIdsFor("tabGroup", filter.value))),
    ...windowFilters
      .filter((filter) => filter.mode === "exclude")
      .flatMap((filter) => (filter.value === null ? [] : tabIdsFor("window", filter.value))),
  ];
  if (
    [...tabGroupFilters, ...windowFilters].some(
      (filter) => filter.value === null || !isNonNegativeInteger(filter.value),
    )
  ) {
    return { error: "An enabled tab group or window filter has no valid value" };
  }
  if (
    [...tabGroupFilters, ...windowFilters].some((filter) => filter.mode === "include") &&
    tabs.length === 0
  ) {
    return { error: "Tab group and window filters require tab context" };
  }
  if (includeScopedTabIds.length > 0) {
    condition.tabIds = uniq([...(condition.tabIds ?? []), ...includeScopedTabIds]);
  } else if ([...tabGroupFilters, ...windowFilters].some((filter) => filter.mode === "include")) {
    return { error: "Tab group or window filters match no open tabs" };
  }
  if (excludeScopedTabIds.length > 0) {
    condition.excludedTabIds = uniq([...(condition.excludedTabIds ?? []), ...excludeScopedTabIds]);
  }

  const initiatorFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "initiator" }> =>
      filter.kind === "initiator",
  );
  const normalizedInitiators = initiatorFilters.map((filter) => ({
    ...filter,
    value: filter.value.trim(),
  }));
  if (normalizedInitiators.some((filter) => !isDomain(filter.value))) {
    return { error: "An enabled initiator filter has an invalid domain" };
  }
  const initiatorDomains = uniq(
    normalizedInitiators
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value),
  );
  const excludedInitiatorDomains = uniq(
    normalizedInitiators
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value),
  );
  if (initiatorDomains.length > 0) condition.initiatorDomains = initiatorDomains;
  if (excludedInitiatorDomains.length > 0) {
    condition.excludedInitiatorDomains = excludedInitiatorDomains;
  }

  const requestDomainFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "requestDomain" }> =>
      filter.kind === "requestDomain",
  );
  const normalizedRequestDomains = requestDomainFilters.map((filter) => ({
    ...filter,
    value: filter.value.trim().toLowerCase(),
  }));
  if (normalizedRequestDomains.some((filter) => !isDomain(filter.value))) {
    return { error: "An enabled request domain filter has an invalid domain" };
  }
  const requestDomains = uniq(
    normalizedRequestDomains
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value),
  );
  const excludedRequestDomains = uniq(
    normalizedRequestDomains
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value),
  );
  if (requestDomains.length > 0) condition.requestDomains = requestDomains;
  if (excludedRequestDomains.length > 0) {
    condition.excludedRequestDomains = excludedRequestDomains;
  }

  return { condition };
}

function compileUrlFilters(
  filters: ProfileFilter[],
): { included: UrlProfileFilter[]; excluded: UrlProfileFilter[] } | { error: string } {
  const urlFilters = filters.filter(
    (filter): filter is UrlProfileFilter =>
      filter.kind === "urlPattern" || filter.kind === "urlRegex",
  );
  const normalized: UrlProfileFilter[] = [];
  for (const filter of urlFilters) {
    const value = filter.value.trim();
    if (!value || !isAscii(value)) {
      return { error: "An enabled URL filter is empty or contains non-ASCII characters" };
    }
    if (filter.kind === "urlRegex" && !isJavascriptRegex(value)) {
      return { error: "An enabled URL regex filter is invalid" };
    }
    normalized.push({ ...filter, value });
  }
  return {
    included: normalized.filter((filter) => filter.mode === "include"),
    excluded: normalized.filter((filter) => filter.mode === "exclude"),
  };
}

function withUrlCondition(condition: DnrCondition, filter?: UrlProfileFilter): DnrCondition {
  if (!filter) return { ...condition };
  return filter.kind === "urlRegex"
    ? { ...condition, regexFilter: filter.value }
    : { ...condition, urlFilter: filter.value };
}

function headerRuleToDnr(
  rule: HeaderRule,
  type: "requestHeaders" | "responseHeaders",
  condition: DnrCondition,
  urlFilter?: UrlProfileFilter,
): PendingProfileDnrRule | null {
  const name = rule.name.trim();
  if (!isEffectiveHeaderRule(rule)) return null;

  return {
    action: {
      type: "modifyHeaders",
      [type]: [
        {
          header: name,
          operation: appendModeToOperation(rule),
          value: rule.value,
        },
      ],
    },
    condition: withUrlCondition(condition, urlFilter),
  };
}

function contentSecurityPolicyToDnr(
  rules: CspRule[],
  condition: DnrCondition,
  urlFilter?: UrlProfileFilter,
): PendingProfileDnrRule | null {
  const value = createContentSecurityPolicyValue(rules.filter(isEffectiveCspRule));
  if (!value) return null;

  return {
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {
          header: CONTENT_SECURITY_POLICY_HEADER,
          operation: "set",
          value,
        },
      ],
    },
    condition: withUrlCondition(condition, urlFilter),
  };
}

function cookiesToDnr(
  cookies: NameValueRule[],
  condition: DnrCondition,
  urlFilter?: UrlProfileFilter,
): PendingProfileDnrRule | null {
  const value = cookies
    .filter(isEffectiveCookieRule)
    .map((cookie) => `${cookie.name.trim()}=${cookie.value}`)
    .join("; ");
  if (!value) return null;

  return {
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "cookie", operation: "set", value }],
    },
    condition: withUrlCondition(condition, urlFilter),
  };
}

function urlReplacementToDnr(
  replacement: NameValueRule,
  condition: DnrCondition,
): PendingProfileDnrRule | null {
  const regexFilter = replacement.name.trim();
  if (!isEffectiveRedirectRule(replacement)) return null;

  return {
    action: {
      type: "redirect",
      redirect: {
        regexSubstitution: replacement.value.replace(/(?<!\\)\$(\d+)/g, "\\$1"),
      },
    },
    condition: { ...condition, regexFilter },
  };
}

function excludeUrlToDnr(filter: UrlProfileFilter, condition: DnrCondition): PendingProfileDnrRule {
  return {
    action: { type: "allow" },
    condition: withUrlCondition(condition, filter),
  };
}

function rulePriority(rule: PendingProfileDnrRule, typeIndex: number): number {
  if (rule.action.type === "allow") return 10000 - typeIndex;
  if (rule.action.type === "redirect") return 5000 - typeIndex;
  return 1000 - typeIndex;
}

function finalizeRules(rules: PendingProfileDnrRule[]): ProfileDnrRule[] {
  const typeCounts = { allow: 0, redirect: 0, modifyHeaders: 0 };
  return rules.map((rule, index) => {
    const actionType = rule.action.type as keyof typeof typeCounts;
    const typeIndex = typeCounts[actionType]++;
    return {
      ...rule,
      id: PROFILE_DNR_RULE_ID_BASE + index,
      priority: rulePriority(rule, typeIndex),
    } as ProfileDnrRule;
  });
}

export function compileProfileDnrRules(
  profile?: Profile,
  options: ProfileDnrCompileOptions = {},
): ProfileDnrCompilation {
  if (!profile?.enabled || profile.paused) return { rules: [], diagnostics: [] };
  if (!hasActiveTimeFilters(profile)) return { rules: [], diagnostics: [] };

  const filters = activeFilters(profile);
  const conditionResult = compileProfileCondition(filters, options);
  if ("error" in conditionResult) return failedCompilation(conditionResult.error);
  const urlResult = compileUrlFilters(filters);
  if ("error" in urlResult) return failedCompilation(urlResult.error);

  const enabledReplacements = profile.rules.redirects.filter(isEffectiveRedirectRule);
  if (
    enabledReplacements.some(
      (replacement) =>
        !isAscii(replacement.name.trim()) || !isJavascriptRegex(replacement.name.trim()),
    )
  ) {
    return failedCompilation("An enabled redirect has an invalid regular expression");
  }
  if (urlResult.included.length > 0 && enabledReplacements.length > 0) {
    return failedCompilation(
      "URL include filters cannot be combined safely with redirect regular expressions",
    );
  }

  const urlVariants: Array<UrlProfileFilter | undefined> =
    urlResult.included.length > 0 ? urlResult.included : [undefined];
  const actionRules: PendingProfileDnrRule[] = [];

  for (const rule of profile.rules.requestHeaders) {
    for (const urlFilter of urlVariants) {
      const candidate = headerRuleToDnr(
        rule,
        "requestHeaders",
        conditionResult.condition,
        urlFilter,
      );
      if (candidate) actionRules.push(candidate);
    }
  }
  for (const rule of profile.rules.responseHeaders) {
    for (const urlFilter of urlVariants) {
      const candidate = headerRuleToDnr(
        rule,
        "responseHeaders",
        conditionResult.condition,
        urlFilter,
      );
      if (candidate) actionRules.push(candidate);
    }
  }
  for (const urlFilter of urlVariants) {
    const candidate = contentSecurityPolicyToDnr(
      profile.rules.csp,
      conditionResult.condition,
      urlFilter,
    );
    if (candidate) actionRules.push(candidate);
  }
  for (const urlFilter of urlVariants) {
    const candidate = cookiesToDnr(profile.rules.cookies, conditionResult.condition, urlFilter);
    if (candidate) actionRules.push(candidate);
  }
  for (const replacement of enabledReplacements) {
    const candidate = urlReplacementToDnr(replacement, conditionResult.condition);
    if (candidate) actionRules.push(candidate);
  }

  if (actionRules.length === 0) return { rules: [], diagnostics: [] };

  const pendingRules = [
    ...urlResult.excluded.map((filter) => excludeUrlToDnr(filter, conditionResult.condition)),
    ...actionRules,
  ];
  if (pendingRules.length > MAX_PROFILE_DNR_RULES) {
    return failedCompilation(
      `Profile requires ${pendingRules.length} DNR rules, exceeding the ${MAX_PROFILE_DNR_RULES} rule limit`,
    );
  }

  return { rules: finalizeRules(pendingRules), diagnostics: [] };
}

export function profileToDnrRules(profile?: Profile): ProfileDnrRule[] {
  return compileProfileDnrRules(profile).rules;
}

async function unsupportedRegexDiagnostics(rules: ProfileDnrRule[]): Promise<string[]> {
  const diagnostics = await Promise.all(
    rules.map(async (rule) => {
      const regex = rule.condition.regexFilter;
      if (!regex) return null;
      const result = await browser.declarativeNetRequest.isRegexSupported({
        regex,
        requireCapturing: rule.action.type === "redirect",
      });
      return result.isSupported
        ? null
        : `${regex}: ${result.reason ?? "unsupported regular expression"}`;
    }),
  );
  return diagnostics.flatMap((diagnostic) => (diagnostic ? [diagnostic] : []));
}

async function clearManagedDnrRules(): Promise<void> {
  await Promise.all([
    browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: MANAGED_PROFILE_RULE_IDS,
      addRules: [],
    }),
    browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: MANAGED_PROFILE_RULE_IDS,
      addRules: [],
    }),
  ]);
}

export async function applyDnrRules(rules: ProfileDnrRule[]): Promise<void> {
  try {
    if (rules.length > MAX_PROFILE_DNR_RULES) {
      throw new Error(`Profile DNR rule limit exceeded: ${rules.length}`);
    }
    const unsupportedRegexes = await unsupportedRegexDiagnostics(rules);
    if (unsupportedRegexes.length > 0) {
      throw new Error(`Unsupported profile regex: ${unsupportedRegexes.join("; ")}`);
    }

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: MANAGED_PROFILE_RULE_IDS,
      addRules: [],
    });
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: MANAGED_PROFILE_RULE_IDS,
      addRules: rules,
    });
  } catch (error) {
    await clearManagedDnrRules().catch(() => undefined);
    throw error;
  }
}
