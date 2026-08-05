import { browser, type Browser } from "wxt/browser";
import {
  CONTENT_SECURITY_POLICY_HEADER,
  createCspDirectiveValue,
  createContentSecurityPolicyValue,
  isContentSecurityPolicyRule,
  isCspDirectiveRule,
} from "../domain/profile-csp";
import { orderedProfileFilters } from "../domain/profile-filter";
import type {
  CookieRule,
  HeaderRule,
  Profile,
  ProfileFilter,
  UrlReplacement,
} from "../domain/profile-model";

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

const MANAGED_PROFILE_RULE_IDS = Array.from(
  { length: MAX_PROFILE_DNR_RULES },
  (_, index) => PROFILE_DNR_RULE_ID_BASE + index,
);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

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

function isInitiatorDomain(value: string): boolean {
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

function isEffectiveCspDirectiveRule(rule: HeaderRule): boolean {
  return Boolean(
    rule.enabled &&
    isCspDirectiveRule(rule) &&
    (createCspDirectiveValue(rule) || rule.sendEmptyHeader),
  );
}

function isEffectiveCookieRule(cookie: CookieRule): boolean {
  return Boolean(cookie.enabled && cookie.name.trim());
}

function isEffectiveUrlReplacement(replacement: UrlReplacement): boolean {
  return Boolean(replacement.enabled && replacement.name.trim() && replacement.value.trim());
}

export function countEnabledProfileModifications(profile?: Profile): number {
  if (!profile?.enabled || profile.paused) return 0;

  return (
    profile.headers.filter(isEffectiveHeaderRule).length +
    profile.respHeaders.filter((rule) =>
      isCspDirectiveRule(rule) ? isEffectiveCspDirectiveRule(rule) : isEffectiveHeaderRule(rule),
    ).length +
    profile.cookies.filter(isEffectiveCookieRule).length +
    profile.urlReplacements.filter(isEffectiveUrlReplacement).length
  );
}

function activeFilters(profile: Profile): ProfileFilter[] {
  return orderedProfileFilters(profile).filter((filter) => filter.enabled);
}

function compileProfileCondition(
  filters: ProfileFilter[],
): { condition: DnrCondition } | { error: string } {
  const condition: DnrCondition = {};

  const resourceTypeFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "resourceType" }> =>
      filter.kind === "resourceType",
  );
  const includedResources = unique(
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
  const includedMethods = unique(
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
  if (
    tabIdFilters.some(
      (filter) => filter.value === null || !Number.isInteger(filter.value) || filter.value < 0,
    )
  ) {
    return { error: "An enabled tab filter has no valid tab" };
  }
  const includedTabIds = unique(
    tabIdFilters
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value as number),
  );
  const excludedTabIds = unique(
    tabIdFilters
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value as number),
  );
  if (includedTabIds.length > 0) condition.tabIds = includedTabIds;
  if (excludedTabIds.length > 0) condition.excludedTabIds = excludedTabIds;

  const initiatorFilters = filters.filter(
    (filter): filter is Extract<ProfileFilter, { kind: "initiator" }> =>
      filter.kind === "initiator",
  );
  const normalizedInitiators = initiatorFilters.map((filter) => ({
    ...filter,
    value: filter.value.trim(),
  }));
  if (normalizedInitiators.some((filter) => !isInitiatorDomain(filter.value))) {
    return { error: "An enabled initiator filter has an invalid domain" };
  }
  const initiatorDomains = unique(
    normalizedInitiators
      .filter((filter) => filter.mode === "include")
      .map((filter) => filter.value),
  );
  const excludedInitiatorDomains = unique(
    normalizedInitiators
      .filter((filter) => filter.mode === "exclude")
      .map((filter) => filter.value),
  );
  if (initiatorDomains.length > 0) condition.initiatorDomains = initiatorDomains;
  if (excludedInitiatorDomains.length > 0) {
    condition.excludedInitiatorDomains = excludedInitiatorDomains;
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
  rules: HeaderRule[],
  operation: HeaderOperation,
  condition: DnrCondition,
  urlFilter?: UrlProfileFilter,
): PendingProfileDnrRule | null {
  const value = createContentSecurityPolicyValue(rules);
  const effectiveRules = rules.filter(isEffectiveCspDirectiveRule);
  if (!value && effectiveRules.length === 0) return null;

  return {
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {
          header: CONTENT_SECURITY_POLICY_HEADER,
          operation,
          value,
        },
      ],
    },
    condition: withUrlCondition(condition, urlFilter),
  };
}

function cookiesToDnr(
  cookies: CookieRule[],
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
  replacement: UrlReplacement,
  condition: DnrCondition,
): PendingProfileDnrRule | null {
  const regexFilter = replacement.name.trim();
  if (!isEffectiveUrlReplacement(replacement)) return null;

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

export function compileProfileDnrRules(profile?: Profile): ProfileDnrCompilation {
  if (!profile?.enabled || profile.paused) return { rules: [], diagnostics: [] };

  const filters = activeFilters(profile);
  const conditionResult = compileProfileCondition(filters);
  if ("error" in conditionResult) return failedCompilation(conditionResult.error);
  const urlResult = compileUrlFilters(filters);
  if ("error" in urlResult) return failedCompilation(urlResult.error);

  const enabledReplacements = profile.urlReplacements.filter(isEffectiveUrlReplacement);
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

  for (const rule of profile.headers) {
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
  const contentSecurityPolicyRules = profile.respHeaders.filter(isCspDirectiveRule);
  const hasEffectiveLegacyContentSecurityPolicy = profile.respHeaders.some(
    (rule) =>
      isContentSecurityPolicyRule(rule) && !isCspDirectiveRule(rule) && isEffectiveHeaderRule(rule),
  );
  for (const rule of profile.respHeaders) {
    if (isCspDirectiveRule(rule)) continue;
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
      contentSecurityPolicyRules,
      hasEffectiveLegacyContentSecurityPolicy ? "append" : "set",
      conditionResult.condition,
      urlFilter,
    );
    if (candidate) actionRules.push(candidate);
  }
  for (const urlFilter of urlVariants) {
    const candidate = cookiesToDnr(profile.cookies, conditionResult.condition, urlFilter);
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
  const diagnostics: string[] = [];
  for (const rule of rules) {
    const regex = rule.condition.regexFilter;
    if (!regex) continue;
    const result = await browser.declarativeNetRequest.isRegexSupported({
      regex,
      requireCapturing: rule.action.type === "redirect",
    });
    if (!result.isSupported) {
      diagnostics.push(`${regex}: ${result.reason ?? "unsupported regular expression"}`);
    }
  }
  return diagnostics;
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
