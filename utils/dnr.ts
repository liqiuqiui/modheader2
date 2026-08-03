import { browser, type Browser } from "wxt/browser";
import type {
  CookieRule,
  DomainFilter,
  HeaderRule,
  MethodFilter,
  Profile,
  ResourceFilter,
  TabFilter,
  UrlFilter,
  UrlReplacement,
} from "../types";

const DNR_RULE_ID_BASE = 10000;
const MAX_RULES_PER_PROFILE = 100;
const DEFAULT_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "stylesheet",
  "image",
  "font",
  "media",
  "object",
  "other",
] as Browser.declarativeNetRequest.ResourceType[];

type DnrRule = Browser.declarativeNetRequest.Rule;
type HeaderOperation = "append" | "set";

function appendModeToOperation(rule: HeaderRule): HeaderOperation {
  if (rule.appendMode === "append" || rule.appendMode === "comma") return "append";
  return "set";
}

function enabledValues<T extends { enabled: boolean }>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => item.enabled);
}

function applyProfileConditions(profile: Profile): Browser.declarativeNetRequest.RuleCondition {
  const condition: Browser.declarativeNetRequest.RuleCondition = {
    resourceTypes: DEFAULT_RESOURCE_TYPES,
  };

  const resourceFilters = enabledValues<ResourceFilter>(profile.resourceFilters);
  const includedResources = resourceFilters
    .filter((filter) => !filter.exclude)
    .flatMap((filter) => filter.resourceType)
    .filter(Boolean) as Browser.declarativeNetRequest.ResourceType[];
  const excludedResources = resourceFilters
    .filter((filter) => filter.exclude)
    .flatMap((filter) => filter.resourceType)
    .filter(Boolean) as Browser.declarativeNetRequest.ResourceType[];

  if (includedResources.length > 0) {
    condition.resourceTypes = [...new Set(includedResources)];
  } else if (excludedResources.length > 0) {
    condition.resourceTypes = DEFAULT_RESOURCE_TYPES.filter(
      (type) => !excludedResources.includes(type),
    );
  }

  const tabs = enabledValues<TabFilter>(profile.tabFilters);
  const includedTabs = tabs
    .filter((filter) => !filter.exclude)
    .map((filter) => Number(filter.tabId))
    .filter((tabId) => Number.isInteger(tabId) && tabId >= 0);
  const excludedTabs = tabs
    .filter((filter) => filter.exclude)
    .map((filter) => Number(filter.tabId))
    .filter((tabId) => Number.isInteger(tabId) && tabId >= 0);
  if (includedTabs.length > 0) condition.tabIds = [...new Set(includedTabs)];
  if (excludedTabs.length > 0) condition.excludedTabIds = [...new Set(excludedTabs)];

  const methods = enabledValues<MethodFilter>(profile.methodFilters);
  const includedMethods = methods
    .filter((filter) => !filter.exclude)
    .map((filter) => filter.method);
  const excludedMethods = methods.filter((filter) => filter.exclude).map((filter) => filter.method);
  if (includedMethods.length > 0) {
    condition.requestMethods = [
      ...new Set(includedMethods),
    ] as Browser.declarativeNetRequest.RequestMethod[];
  } else if (excludedMethods.length > 0) {
    condition.excludedRequestMethods = [
      ...new Set(excludedMethods),
    ] as Browser.declarativeNetRequest.RequestMethod[];
  }

  const domains = enabledValues<DomainFilter>(profile.initiatorDomainFilters)
    .map((filter) => filter.domain.trim())
    .filter(Boolean);
  const includedDomains = enabledValues<DomainFilter>(profile.initiatorDomainFilters)
    .filter((filter) => !filter.exclude)
    .map((filter) => filter.domain.trim())
    .filter(Boolean);
  const excludedDomains = domains.filter((domain) => !includedDomains.includes(domain));
  if (includedDomains.length > 0) condition.initiatorDomains = [...new Set(includedDomains)];
  if (excludedDomains.length > 0)
    condition.excludedInitiatorDomains = [...new Set(excludedDomains)];

  return condition;
}

function withUrlCondition(
  condition: Browser.declarativeNetRequest.RuleCondition,
  filter?: UrlFilter,
) {
  if (!filter?.urlRegex.trim()) return condition;
  const value = filter.urlRegex.trim();
  if (filter.matchType === "regex") condition.regexFilter = value;
  else condition.urlFilter = value;
  return condition;
}

function headerRuleToDnr(
  rule: HeaderRule,
  type: "requestHeaders" | "responseHeaders",
  baseId: number,
  profile: Profile,
  urlFilter?: UrlFilter,
): DnrRule | null {
  if (!rule.enabled || (!rule.name.trim() && !rule.sendEmptyHeader)) return null;
  if (!rule.name.trim()) return null;

  const operation: Browser.declarativeNetRequest.ModifyHeaderInfo = {
    header: rule.name.trim(),
    operation: appendModeToOperation(rule),
  };
  if (rule.value || rule.sendEmptyHeader) operation.value = rule.value;

  return {
    id: baseId,
    priority: 10,
    action: {
      type: "modifyHeaders",
      [type]: [operation],
    },
    condition: withUrlCondition(applyProfileConditions(profile), urlFilter),
  };
}

function urlReplacementToDnr(
  replacement: UrlReplacement,
  id: number,
  profile: Profile,
): DnrRule | null {
  if (!replacement.enabled || !replacement.name.trim() || !replacement.value.trim()) return null;

  const substitution = replacement.value.replace(/(?<!\\)\$(\d+)/g, "\\$1");
  return {
    id,
    priority: 20,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: substitution },
    },
    condition: { ...applyProfileConditions(profile), regexFilter: replacement.name.trim() },
  };
}

function cookiesToDnr(
  cookies: CookieRule[],
  id: number,
  profile: Profile,
  urlFilter?: UrlFilter,
): DnrRule | null {
  const value = cookies
    .filter((cookie) => cookie.enabled && cookie.name.trim())
    .map((cookie) => `${cookie.name.trim()}=${cookie.value}`)
    .join("; ");
  if (!value) return null;

  return {
    id,
    priority: 10,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "cookie", operation: "set", value }],
    },
    condition: withUrlCondition(applyProfileConditions(profile), urlFilter),
  };
}

function excludeUrlToDnr(filter: UrlFilter, id: number, profile: Profile): DnrRule | null {
  if (!filter.enabled || !filter.urlRegex.trim()) return null;
  return {
    id,
    priority: 100,
    action: { type: "allow" },
    condition: withUrlCondition(applyProfileConditions(profile), filter),
  };
}

function activeUrlFilters(filters: UrlFilter[] | undefined): UrlFilter[] {
  return enabledValues(filters).filter((filter) => filter.urlRegex.trim());
}

export function profilesToDnrRules(profiles: Profile[], selectedIndex: number): DnrRule[] {
  const profile = profiles[selectedIndex];
  if (!profile || !profile.enabled || profile.paused) return [];

  const rules: DnrRule[] = [];
  let ruleId = DNR_RULE_ID_BASE;
  const includeFilters = activeUrlFilters(profile.urlFilters);
  const excludeFilters = activeUrlFilters(profile.excludeUrlFilters);
  const urlVariants: Array<UrlFilter | undefined> =
    includeFilters.length > 0 ? includeFilters : [undefined];

  // 排除规则使用更高优先级的 allow，让后续修改规则不再继续处理该请求。
  for (const filter of excludeFilters) {
    const dnr = excludeUrlToDnr(filter, ruleId++, profile);
    if (dnr) rules.push(dnr);
  }

  for (const rule of profile.headers ?? []) {
    for (const urlFilter of urlVariants) {
      const dnr = headerRuleToDnr(rule, "requestHeaders", ruleId++, profile, urlFilter);
      if (dnr) rules.push(dnr);
      if (rules.length >= MAX_RULES_PER_PROFILE) return rules.slice(0, MAX_RULES_PER_PROFILE);
    }
  }

  for (const rule of profile.respHeaders ?? []) {
    for (const urlFilter of urlVariants) {
      const dnr = headerRuleToDnr(rule, "responseHeaders", ruleId++, profile, urlFilter);
      if (dnr) rules.push(dnr);
      if (rules.length >= MAX_RULES_PER_PROFILE) return rules.slice(0, MAX_RULES_PER_PROFILE);
    }
  }

  for (const urlFilter of urlVariants) {
    const dnr = cookiesToDnr(profile.cookies ?? [], ruleId++, profile, urlFilter);
    if (dnr) rules.push(dnr);
    if (rules.length >= MAX_RULES_PER_PROFILE) return rules.slice(0, MAX_RULES_PER_PROFILE);
  }

  for (const replacement of profile.urlReplacements ?? []) {
    const dnr = urlReplacementToDnr(replacement, ruleId++, profile);
    if (dnr) rules.push(dnr);
    if (rules.length >= MAX_RULES_PER_PROFILE) return rules.slice(0, MAX_RULES_PER_PROFILE);
  }

  return rules;
}

export async function applyDnrRules(rules: DnrRule[]) {
  // tabIds 仅支持 session-scoped rules，因此统一使用 session 规则；后台启动时会重新同步。
  const [dynamicRules, sessionRules] = await Promise.all([
    browser.declarativeNetRequest.getDynamicRules(),
    browser.declarativeNetRequest.getSessionRules(),
  ]);

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: dynamicRules.map((rule) => rule.id),
    addRules: [],
  });
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: sessionRules.map((rule) => rule.id),
    addRules: rules,
  });
}
