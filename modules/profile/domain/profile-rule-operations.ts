import type {
  AppendMode,
  CookieRule,
  HeaderRule,
  Profile,
  ProfileRule,
  ProfileRuleCollection,
  UrlReplacement,
} from "./profile-model";
import { CONTENT_SECURITY_POLICY_HEADER, isContentSecurityPolicyRule } from "./profile-csp";
import { profileHasEntityId } from "./profile-operations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuleCollection(value: unknown): value is ProfileRuleCollection {
  return (
    value === "headers" ||
    value === "respHeaders" ||
    value === "csp" ||
    value === "cookies" ||
    value === "urlReplacements"
  );
}

function ruleCollection(profile: Profile, collection: ProfileRuleCollection): ProfileRule[] {
  if (collection === "headers") return profile.headers;
  if (collection === "respHeaders") {
    return profile.respHeaders.filter((rule) => !isContentSecurityPolicyRule(rule));
  }
  if (collection === "csp") {
    return profile.respHeaders.filter(isContentSecurityPolicyRule);
  }
  if (collection === "cookies") return profile.cookies;
  return profile.urlReplacements;
}

function replaceResponseRuleCollection(
  profile: Profile,
  collection: Extract<ProfileRuleCollection, "respHeaders" | "csp">,
  rules: ProfileRule[],
): Profile {
  const matchesCollection =
    collection === "csp"
      ? isContentSecurityPolicyRule
      : (rule: HeaderRule) => !isContentSecurityPolicyRule(rule);
  const existingIds = new Set(profile.respHeaders.filter(matchesCollection).map((rule) => rule.id));
  const normalizeRule = (rule: HeaderRule): HeaderRule =>
    collection === "csp" ? { ...rule, name: CONTENT_SECURITY_POLICY_HEADER } : rule;
  const replacements = new Map(
    (rules as HeaderRule[]).map((rule) => [rule.id, normalizeRule(rule)]),
  );
  const respHeaders: HeaderRule[] = [];
  for (const rule of profile.respHeaders) {
    if (!existingIds.has(rule.id)) {
      respHeaders.push(rule);
      continue;
    }
    const replacement = replacements.get(rule.id);
    if (replacement) {
      respHeaders.push(replacement);
      replacements.delete(rule.id);
    }
  }
  respHeaders.push(...replacements.values());
  return { ...profile, respHeaders };
}

function locateRule(
  profile: Profile,
  collection: ProfileRuleCollection,
  ruleId: string,
): { collection: ProfileRuleCollection; rule: ProfileRule } | undefined {
  const collections: ProfileRuleCollection[] = [collection];
  if (collection === "headers" || collection === "respHeaders" || collection === "csp") {
    for (const alternate of ["headers", "respHeaders", "csp"] as const) {
      if (!collections.includes(alternate)) collections.push(alternate);
    }
  }
  for (const candidate of collections) {
    const rule = ruleCollection(profile, candidate).find((item) => item.id === ruleId);
    if (rule) return { collection: candidate, rule };
  }
  return undefined;
}

function replaceRuleCollection(
  profile: Profile,
  collection: ProfileRuleCollection,
  rules: ProfileRule[],
): Profile {
  if (collection === "headers") return { ...profile, headers: rules as HeaderRule[] };
  if (collection === "respHeaders" || collection === "csp") {
    return replaceResponseRuleCollection(profile, collection, rules);
  }
  if (collection === "cookies") return { ...profile, cookies: rules as CookieRule[] };
  return { ...profile, urlReplacements: rules as UrlReplacement[] };
}

function isAppendMode(value: unknown): value is AppendMode {
  return value === "override" || value === "append" || value === "comma";
}

function sanitizedRulePatch(
  collection: ProfileRuleCollection,
  patch: unknown,
): Record<string, unknown> {
  if (!isRecord(patch)) return {};
  const sanitized: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") sanitized.enabled = patch.enabled;
  if (typeof patch.value === "string") sanitized.value = patch.value;
  if (typeof patch.comment === "string") sanitized.comment = patch.comment;
  if (collection === "csp") return sanitized;
  if (typeof patch.name === "string") sanitized.name = patch.name;
  if (collection === "headers" || collection === "respHeaders") {
    if (isAppendMode(patch.appendMode)) sanitized.appendMode = patch.appendMode;
    if (typeof patch.sendEmptyHeader === "boolean") {
      sanitized.sendEmptyHeader = patch.sendEmptyHeader;
    }
  }
  return sanitized;
}

export function addProfileRule(profile: Profile, collection: unknown, rule: unknown): Profile {
  if (
    !isRuleCollection(collection) ||
    !isRecord(rule) ||
    typeof rule.id !== "string" ||
    rule.id.length === 0 ||
    profileHasEntityId(profile, rule.id)
  ) {
    return profile;
  }
  const normalizedRule =
    collection === "csp"
      ? {
          ...(rule as unknown as HeaderRule),
          name: CONTENT_SECURITY_POLICY_HEADER,
          cspMode: "directive" as const,
        }
      : (rule as unknown as ProfileRule);
  return replaceRuleCollection(profile, collection, [
    ...ruleCollection(profile, collection),
    normalizedRule,
  ]);
}

export function patchProfileRule(
  profile: Profile,
  collection: unknown,
  ruleId: string,
  patch: unknown,
): Profile {
  if (!isRuleCollection(collection)) return profile;
  const located = locateRule(profile, collection, ruleId);
  if (!located) return profile;
  const rules = ruleCollection(profile, located.collection);
  const sanitized = sanitizedRulePatch(located.collection, patch);
  if (
    Object.keys(sanitized).length === 0 ||
    Object.entries(sanitized).every(
      ([key, value]) => located.rule[key as keyof ProfileRule] === value,
    )
  ) {
    return profile;
  }
  return replaceRuleCollection(
    profile,
    located.collection,
    rules.map((item) =>
      item.id === ruleId ? ({ ...item, ...sanitized, id: item.id } as ProfileRule) : item,
    ),
  );
}

export function deleteProfileRule(profile: Profile, collection: unknown, ruleId: string): Profile {
  if (!isRuleCollection(collection)) return profile;
  const located = locateRule(profile, collection, ruleId);
  if (!located) return profile;
  return replaceRuleCollection(
    profile,
    located.collection,
    ruleCollection(profile, located.collection).filter((rule) => rule.id !== ruleId),
  );
}

export function cloneProfileRule(
  profile: Profile,
  collection: unknown,
  ruleId: string,
  cloneId: string,
): Profile {
  if (
    !isRuleCollection(collection) ||
    typeof cloneId !== "string" ||
    cloneId.length === 0 ||
    profileHasEntityId(profile, cloneId)
  ) {
    return profile;
  }
  const located = locateRule(profile, collection, ruleId);
  if (!located) return profile;
  return replaceRuleCollection(profile, located.collection, [
    ...ruleCollection(profile, located.collection),
    { ...located.rule, id: cloneId },
  ]);
}

export function setProfileRulesEnabled(
  profile: Profile,
  collection: unknown,
  enabled: unknown,
): Profile {
  if (!isRuleCollection(collection) || typeof enabled !== "boolean") return profile;
  const rules = ruleCollection(profile, collection);
  if (rules.every((rule) => rule.enabled === enabled)) return profile;
  return replaceRuleCollection(
    profile,
    collection,
    rules.map((rule) => ({ ...rule, enabled })),
  );
}

export function clearProfileRules(profile: Profile, collection: unknown): Profile {
  if (!isRuleCollection(collection) || ruleCollection(profile, collection).length === 0) {
    return profile;
  }
  return replaceRuleCollection(profile, collection, []);
}

export function convertProfileHeader(profile: Profile, ruleId: string, target: unknown): Profile {
  if (target !== "headers" && target !== "respHeaders") return profile;
  const source = target === "headers" ? "respHeaders" : "headers";
  const located = locateRule(profile, source, ruleId);
  const alreadyInTarget =
    located &&
    (target === "headers"
      ? located.collection === "headers"
      : located.collection === "respHeaders" || located.collection === "csp");
  if (!located || alreadyInTarget) return profile;
  const withoutSource = replaceRuleCollection(
    profile,
    located.collection,
    ruleCollection(profile, located.collection).filter((item) => item.id !== ruleId),
  );
  return replaceRuleCollection(withoutSource, target, [
    ...ruleCollection(withoutSource, target),
    located.rule,
  ]);
}

export function sortProfileRuleCollections(profile: Profile): Profile {
  const headers = [...profile.headers].sort((left, right) => left.name.localeCompare(right.name));
  const respHeaders = [...profile.respHeaders].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const unchanged =
    headers.every((rule, index) => profile.headers[index]?.id === rule.id) &&
    respHeaders.every((rule, index) => profile.respHeaders[index]?.id === rule.id);
  return unchanged ? profile : { ...profile, headers, respHeaders };
}
