import {
  cspRuleFromHeaderRule,
  headerRuleFromCspRule,
  isContentSecurityPolicyHeaderRule,
  joinCspDirective,
  splitCspDirective,
} from "./profile-csp";
import {
  isAppendMode,
  isNonEmptyString,
  isProfileRuleCollection,
  isRecord,
} from "./profile-guards";
import type {
  CspRule,
  HeaderRule,
  NameValueRule,
  Profile,
  ProfileRule,
  ProfileRuleCollection,
} from "./profile-model";
import { profileHasEntityId } from "./profile-operations";
import { isCspRule, isHeaderRule, isNameValueRule } from "./profile-validation";

function ruleCollection(profile: Profile, collection: ProfileRuleCollection): ProfileRule[] {
  if (collection === "requestHeaders") return profile.rules.requestHeaders;
  if (collection === "responseHeaders") return profile.rules.responseHeaders;
  if (collection === "csp") return profile.rules.csp;
  if (collection === "cookies") return profile.rules.cookies;
  return profile.rules.redirects;
}

function replaceRuleCollection(
  profile: Profile,
  collection: ProfileRuleCollection,
  rules: ProfileRule[],
): Profile {
  if (collection === "requestHeaders") {
    return { ...profile, rules: { ...profile.rules, requestHeaders: rules as HeaderRule[] } };
  }
  if (collection === "responseHeaders") {
    return { ...profile, rules: { ...profile.rules, responseHeaders: rules as HeaderRule[] } };
  }
  if (collection === "csp") {
    return { ...profile, rules: { ...profile.rules, csp: rules as CspRule[] } };
  }
  if (collection === "cookies") {
    return { ...profile, rules: { ...profile.rules, cookies: rules as NameValueRule[] } };
  }
  return { ...profile, rules: { ...profile.rules, redirects: rules as NameValueRule[] } };
}

function isRuleForCollection(
  collection: ProfileRuleCollection,
  rule: unknown,
): rule is ProfileRule {
  if (collection === "requestHeaders" || collection === "responseHeaders") {
    return isHeaderRule(rule);
  }
  if (collection === "csp") return isCspRule(rule);
  return isNameValueRule(rule);
}

function appendRule(
  profile: Profile,
  collection: ProfileRuleCollection,
  rule: ProfileRule,
): Profile {
  return replaceRuleCollection(profile, collection, [...ruleCollection(profile, collection), rule]);
}

function locateRule(
  profile: Profile,
  collection: ProfileRuleCollection,
  ruleId: string,
): { collection: ProfileRuleCollection; rule: ProfileRule } | undefined {
  const candidates: ProfileRuleCollection[] = [collection];
  if (collection === "requestHeaders" || collection === "responseHeaders" || collection === "csp") {
    for (const alternate of ["requestHeaders", "responseHeaders", "csp"] as const) {
      if (!candidates.includes(alternate)) candidates.push(alternate);
    }
  }

  for (const candidate of candidates) {
    const rule = ruleCollection(profile, candidate).find((item) => item.id === ruleId);
    if (rule) return { collection: candidate, rule };
  }
  return undefined;
}

function sanitizeCommonPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") sanitized.enabled = patch.enabled;
  if (typeof patch.value === "string") sanitized.value = patch.value;
  if (typeof patch.comment === "string") sanitized.comment = patch.comment;
  return sanitized;
}

function sanitizedRulePatch(
  actualCollection: ProfileRuleCollection,
  requestedCollection: ProfileRuleCollection,
  patch: unknown,
): Record<string, unknown> {
  if (!isRecord(patch)) return {};
  const sanitized = sanitizeCommonPatch(patch);

  if (actualCollection === "csp") {
    if (requestedCollection === "responseHeaders" && typeof patch.value === "string") {
      const parsed = splitCspDirective(patch.value);
      sanitized.directive = parsed.directive;
      sanitized.value = parsed.value;
    } else if (typeof patch.directive === "string") {
      sanitized.directive = patch.directive;
    }
    return sanitized;
  }

  if (actualCollection === "requestHeaders" || actualCollection === "responseHeaders") {
    if (typeof patch.name === "string") sanitized.name = patch.name;
    if (isAppendMode(patch.appendMode)) sanitized.appendMode = patch.appendMode;
    if (typeof patch.sendEmptyHeader === "boolean") {
      sanitized.sendEmptyHeader = patch.sendEmptyHeader;
    }
    if (requestedCollection === "csp") {
      const directive = typeof patch.directive === "string" ? patch.directive : "";
      const value = typeof patch.value === "string" ? patch.value : "";
      if (directive || value) sanitized.value = joinCspDirective(directive, value);
    }
    return sanitized;
  }

  if (typeof patch.name === "string") sanitized.name = patch.name;
  return sanitized;
}

function patchMatches(rule: ProfileRule, patch: Record<string, unknown>): boolean {
  return Object.entries(patch).every(([key, value]) =>
    Object.is(rule[key as keyof ProfileRule], value),
  );
}

function removeLocatedRule(
  profile: Profile,
  located: { collection: ProfileRuleCollection; rule: ProfileRule },
): Profile {
  const rules = ruleCollection(profile, located.collection).filter(
    (rule) => rule.id !== located.rule.id,
  );
  return replaceRuleCollection(profile, located.collection, rules);
}

export function addProfileRule(profile: Profile, collection: unknown, rule: unknown): Profile {
  if (
    !isProfileRuleCollection(collection) ||
    !isRecord(rule) ||
    !isNonEmptyString(rule.id) ||
    profileHasEntityId(profile, rule.id) ||
    !isRuleForCollection(collection, rule)
  ) {
    return profile;
  }

  if (collection === "responseHeaders") {
    const header = rule as HeaderRule;
    if (isContentSecurityPolicyHeaderRule(header)) {
      return appendRule(profile, "csp", cspRuleFromHeaderRule(header));
    }
  }
  return appendRule(profile, collection, rule as ProfileRule);
}

export function patchProfileRule(
  profile: Profile,
  collection: unknown,
  ruleId: string,
  patch: unknown,
): Profile {
  if (!isProfileRuleCollection(collection)) return profile;
  const located = locateRule(profile, collection, ruleId);
  if (!located) return profile;

  const sanitized = sanitizedRulePatch(located.collection, collection, patch);
  if (Object.keys(sanitized).length === 0 || patchMatches(located.rule, sanitized)) return profile;
  const candidate = { ...located.rule, ...sanitized, id: located.rule.id };
  if (!isRuleForCollection(located.collection, candidate)) return profile;

  if (
    located.collection === "responseHeaders" &&
    isHeaderRule(candidate) &&
    isContentSecurityPolicyHeaderRule(candidate)
  ) {
    return appendRule(removeLocatedRule(profile, located), "csp", cspRuleFromHeaderRule(candidate));
  }

  const rules = ruleCollection(profile, located.collection).map((rule) =>
    rule.id === ruleId ? candidate : rule,
  );
  return replaceRuleCollection(profile, located.collection, rules);
}

export function deleteProfileRule(profile: Profile, collection: unknown, ruleId: string): Profile {
  if (!isProfileRuleCollection(collection)) return profile;
  const located = locateRule(profile, collection, ruleId);
  return located ? removeLocatedRule(profile, located) : profile;
}

export function cloneProfileRule(
  profile: Profile,
  collection: unknown,
  ruleId: string,
  cloneId: string,
): Profile {
  if (
    !isProfileRuleCollection(collection) ||
    !isNonEmptyString(cloneId) ||
    profileHasEntityId(profile, cloneId)
  ) {
    return profile;
  }
  const located = locateRule(profile, collection, ruleId);
  if (!located) return profile;
  return appendRule(profile, located.collection, { ...located.rule, id: cloneId });
}

export function setProfileRulesEnabled(
  profile: Profile,
  collection: unknown,
  enabled: unknown,
): Profile {
  if (!isProfileRuleCollection(collection) || typeof enabled !== "boolean") return profile;
  const rules = ruleCollection(profile, collection);
  if (rules.every((rule) => rule.enabled === enabled)) return profile;
  return replaceRuleCollection(
    profile,
    collection,
    rules.map((rule) => ({ ...rule, enabled })),
  );
}

export function clearProfileRules(profile: Profile, collection: unknown): Profile {
  if (!isProfileRuleCollection(collection) || ruleCollection(profile, collection).length === 0) {
    return profile;
  }
  return replaceRuleCollection(profile, collection, []);
}

export function convertProfileHeader(profile: Profile, ruleId: string, target: unknown): Profile {
  if (target !== "requestHeaders" && target !== "responseHeaders") return profile;
  const located = locateRule(profile, target, ruleId);
  if (!located) return profile;

  const alreadyInTarget =
    located.collection === target || (target === "responseHeaders" && located.collection === "csp");
  if (alreadyInTarget) return profile;

  if (target === "requestHeaders") {
    if (located.collection !== "responseHeaders" && located.collection !== "csp") return profile;
    const rule =
      located.collection === "csp"
        ? headerRuleFromCspRule(located.rule as CspRule)
        : (located.rule as HeaderRule);
    return appendRule(removeLocatedRule(profile, located), "requestHeaders", rule);
  }

  if (located.collection !== "requestHeaders") return profile;
  const rule = located.rule as HeaderRule;
  const withoutSource = removeLocatedRule(profile, located);
  return isContentSecurityPolicyHeaderRule(rule)
    ? appendRule(withoutSource, "csp", cspRuleFromHeaderRule(rule))
    : appendRule(withoutSource, "responseHeaders", rule);
}

function sortRulesByKey<Rule extends { id: string }>(
  rules: Rule[],
  keyOf: (rule: Rule) => string,
): Rule[] {
  const sorted = [...rules].sort((left, right) => keyOf(left).localeCompare(keyOf(right)));
  return sorted.every((rule, index) => rules[index]?.id === rule.id) ? rules : sorted;
}

export function sortProfileRuleCollections(profile: Profile): Profile {
  const requestHeaders = sortRulesByKey(profile.rules.requestHeaders, (rule) => rule.name);
  const responseHeaders = sortRulesByKey(profile.rules.responseHeaders, (rule) => rule.name);
  if (
    requestHeaders === profile.rules.requestHeaders &&
    responseHeaders === profile.rules.responseHeaders
  ) {
    return profile;
  }
  return {
    ...profile,
    rules: { ...profile.rules, requestHeaders, responseHeaders },
  };
}
