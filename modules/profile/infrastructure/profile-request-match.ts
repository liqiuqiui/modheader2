import type { Browser } from "wxt/browser";
import type { ProfileDnrRule } from "./profile-dnr";
import { isHttpUrl } from "./profile-url-utils";

export type ProfileRequestDetails = Pick<
  Browser.webRequest.OnBeforeRequestDetails,
  "initiator" | "method" | "requestId" | "tabId" | "type" | "url"
>;

export type ProfileRequestMatcher = (request: ProfileRequestDetails) => boolean;

const DOMAIN_ANCHOR_PREFIX = String.raw`^[a-z][a-z\d+.-]*:\/\/(?:[^/?#]*@)?(?:[^/?#.:]+\.)*`;
const URL_SEPARATOR = String.raw`(?:[^a-z\d_\-.%]|$)`;

function escapeRegexCharacter(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

function urlFilterToRegex(filter: string, caseSensitive: boolean): RegExp {
  let pattern = filter;
  let prefix = "";
  let suffix = "";

  if (pattern.startsWith("||")) {
    prefix = DOMAIN_ANCHOR_PREFIX;
    pattern = pattern.slice(2);
  } else if (pattern.startsWith("|")) {
    prefix = "^";
    pattern = pattern.slice(1);
  }

  if (pattern.endsWith("|")) {
    suffix = "$";
    pattern = pattern.slice(0, -1);
  }

  let body = "";
  for (const character of pattern) {
    if (character === "*") body += ".*";
    else if (character === "^") body += URL_SEPARATOR;
    else body += escapeRegexCharacter(character);
  }

  return new RegExp(`${prefix}${body}${suffix}`, caseSensitive ? "" : "i");
}

function createUrlMatcher(condition: ProfileDnrRule["condition"]): (url: string) => boolean {
  const caseSensitive = condition.isUrlFilterCaseSensitive ?? false;
  if (condition.regexFilter) {
    try {
      const regex = new RegExp(condition.regexFilter, caseSensitive ? "" : "i");
      return (url) => regex.test(url);
    } catch {
      return () => false;
    }
  }
  if (condition.urlFilter) {
    const regex = urlFilterToRegex(condition.urlFilter, caseSensitive);
    return (url) => regex.test(url);
  }
  return () => true;
}

function hostnameFromInitiator(initiator?: string): string | null {
  if (!initiator || initiator === "null") return null;
  try {
    return new URL(initiator).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  const normalizedDomain = domain.toLowerCase();
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

function matchesAnyDomain(hostname: string | null, domains?: string[]): boolean {
  return Boolean(hostname && domains?.some((domain) => hostnameMatchesDomain(hostname, domain)));
}

function createConditionMatcher(rule: ProfileDnrRule): ProfileRequestMatcher {
  const { condition } = rule;
  const matchesUrl = createUrlMatcher(condition);
  const resourceTypes = new Set<string>(condition.resourceTypes ?? []);
  const excludedResourceTypes = new Set<string>(condition.excludedResourceTypes ?? []);
  const requestMethods = new Set<string>(condition.requestMethods ?? []);
  const excludedRequestMethods = new Set<string>(condition.excludedRequestMethods ?? []);
  const tabIds = new Set(condition.tabIds ?? []);
  const excludedTabIds = new Set(condition.excludedTabIds ?? []);

  return (request) => {
    if (!matchesUrl(request.url)) return false;
    if (resourceTypes.size > 0 && !resourceTypes.has(request.type)) return false;
    if (excludedResourceTypes.has(request.type)) return false;

    const method = request.method.toLowerCase();
    const httpRequest = isHttpUrl(request.url);
    if (requestMethods.size > 0 && (!httpRequest || !requestMethods.has(method))) return false;
    if (httpRequest && excludedRequestMethods.has(method)) return false;

    if (tabIds.size > 0 && !tabIds.has(request.tabId)) return false;
    if (excludedTabIds.has(request.tabId)) return false;

    const initiatorHostname = hostnameFromInitiator(request.initiator);
    if (
      condition.initiatorDomains?.length &&
      !matchesAnyDomain(initiatorHostname, condition.initiatorDomains)
    ) {
      return false;
    }
    if (matchesAnyDomain(initiatorHostname, condition.excludedInitiatorDomains)) return false;

    return true;
  };
}

export function createProfileRequestMatcher(rules: ProfileDnrRule[]): ProfileRequestMatcher {
  const matchers = rules.map((rule) => ({
    actionType: rule.action.type,
    priority: rule.priority ?? 1,
    matches: createConditionMatcher(rule),
  }));

  return (request) => {
    let highestAllowPriority = Number.NEGATIVE_INFINITY;
    let highestModificationPriority = Number.NEGATIVE_INFINITY;

    for (const rule of matchers) {
      if (!rule.matches(request)) continue;
      if (rule.actionType === "allow") {
        highestAllowPriority = Math.max(highestAllowPriority, rule.priority);
      } else if (rule.actionType === "modifyHeaders" || rule.actionType === "redirect") {
        highestModificationPriority = Math.max(highestModificationPriority, rule.priority);
      }
    }

    return highestModificationPriority > highestAllowPriority;
  };
}
